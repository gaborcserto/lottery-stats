<?php

namespace App\Lottery;

use App\Models\Game;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

class LotteryStatistics
{
    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function calculate(Game $game, string $metric, array $options, int $maximumNumber): array
    {
        $scope = $options['set'] ?? ($game->code === 'scandinavian' ? 'machine' : 'main');
        $types = $scope === 'combined' ? ['machine', 'manual'] : [$scope];
        $filters = array_intersect_key($options, DrawingFilters::rules());

        foreach (['year', 'week'] as $key) {
            if (isset($filters[$key])) {
                $filters[$key] = (int) $filters[$key];
            }
        }
        $drawings = DB::table('drawings as d')->where('d.game_id', $game->id);
        DrawingFilters::apply($drawings, $filters, 'd.');

        // A read transaction keeps denominators and aggregates on one SQLite snapshot.
        return DB::transaction(
            function () use ($game, $metric, $options, $maximumNumber, $scope, $types, $filters, $drawings): array {
                $population = (clone $drawings)
                    ->leftJoin('drawing_sets as s', function (JoinClause $join) use ($types): void {
                        $join->on('s.drawing_id', '=', 'd.id')->whereIn('s.type', $types);
                    })
                    ->selectRaw('COUNT(DISTINCT d.id) as drawing_count, COUNT(s.id) as eligible_set_count,
                MIN(d.year) as min_year, MAX(d.year) as max_year,
                DATE(MIN(d.drawn_on)) as from_date, DATE(MAX(d.drawn_on)) as to_date,
                COUNT(DISTINCT CASE WHEN d.drawn_on IS NULL THEN d.id END) as undated_drawing_count')->firstOrFail();
                $summary = [
                    'drawing_count' => (int) $population->drawing_count,
                    'eligible_set_count' => (int) $population->eligible_set_count,
                    'min_year' => $population->min_year === null ? null : (int) $population->min_year,
                    'max_year' => $population->max_year === null ? null : (int) $population->max_year,
                    'from_date' => $population->from_date,
                    'to_date' => $population->to_date,
                    'undated_drawing_count' => (int) $population->undated_drawing_count,
                ];
                $sets = (clone $drawings)
                    ->join('drawing_sets as s', 's.drawing_id', '=', 'd.id')
                    ->whereIn('s.type', $types);
                $denominator = $summary['eligible_set_count'];
                $meta = [
                    'game' => $game->code,
                    'filters' => (object) $filters,
                    'set_scope' => $scope,
                    'drawing_count' => $summary['drawing_count'],
                    'eligible_set_count' => $denominator,
                    'percentage_precision' => 2,
                ];

                $data = match ($metric) {
                    'summary' => $summary,
                    'frequencies' => $this->frequencies($sets, $maximumNumber, $denominator, $options),
                    'parity' => $this->parity($sets, $denominator),
                    'pairs' => $this->pairs($sets, $denominator, (int) ($options['limit'] ?? 20)),
                    'yearly' => $this->yearly($drawings, $types, isset($options['number']) ? (int) $options['number'] : null),
                    default => throw new \InvalidArgumentException('Unsupported statistics metric.'),
                };

                if (in_array($metric, ['frequencies', 'pairs'], true)) {
                    $meta['occurrence_percentage_denominator'] = 'eligible_set_count';
                    $meta['sort'] = $metric === 'pairs' ? 'most' : ($options['sort'] ?? 'number');
                    $meta['limit'] = $options['limit'] ?? ($metric === 'pairs' ? 20 : ($meta['sort'] === 'number' ? $maximumNumber : 10));
                    $meta['limit'] = (int) $meta['limit'];
                }

                if ($metric === 'yearly') {
                    $meta['selected_number'] = isset($options['number']) ? (int) $options['number'] : null;
                    $meta['occurrence_percentage_denominator'] = 'yearly_eligible_set_count';
                }

                return ['data' => $data, 'meta' => $meta];
            },
        );
    }

    /**
     * @param  array<string, mixed>  $options
     * @return list<array{number: int, count: int, occurrence_percentage: float}>
     */
    private function frequencies(Builder $sets, int $maximumNumber, int $denominator, array $options): array
    {
        $counts = (clone $sets)
            ->join('drawing_numbers as n', 'n.drawing_set_id', '=', 's.id')
            ->selectRaw('n.number, COUNT(*) as frequency')
            ->groupBy('n.number')
            ->pluck('frequency', 'n.number');

        $rows = [];
        foreach (range(1, $maximumNumber) as $number) {
            $count = (int) ($counts[$number] ?? 0);
            $rows[] = [
                'number' => $number,
                'count' => $count,
                'occurrence_percentage' => $this->percentage($count, $denominator),
            ];
        }

        $sort = $options['sort'] ?? 'number';
        if ($sort !== 'number') {
            usort(
                $rows,
                fn (array $first, array $second): int => (
                    $sort === 'most'
                        ? $second['count'] <=> $first['count']
                        : $first['count'] <=> $second['count']
                ) ?: $first['number'] <=> $second['number'],
            );
        }

        return array_slice($rows, 0, (int) ($options['limit'] ?? ($sort === 'number' ? $maximumNumber : 10)));
    }

    /** @return array<string, mixed> */
    private function parity(Builder $sets, int $denominator): array
    {
        $perSet = (clone $sets)
            ->leftJoin('drawing_numbers as n', 'n.drawing_set_id', '=', 's.id')
            ->selectRaw('s.id, SUM(CASE WHEN n.number % 2 = 0 THEN 1 ELSE 0 END) as even_count,
                SUM(CASE WHEN n.number % 2 = 1 THEN 1 ELSE 0 END) as odd_count')
            ->groupBy('s.id');
        $groups = DB::query()
            ->fromSub($perSet, 'parity')
            ->selectRaw('even_count, odd_count, COUNT(*) as set_count')
            ->groupBy('even_count', 'odd_count')
            ->orderBy('even_count')
            ->orderBy('odd_count')
            ->get();
        $even = 0;
        $odd = 0;
        $distribution = [];
        foreach ($groups as $group) {
            $even += (int) $group->even_count * (int) $group->set_count;
            $odd += (int) $group->odd_count * (int) $group->set_count;
            $distribution[] = [
                'even_count' => (int) $group->even_count,
                'odd_count' => (int) $group->odd_count,
                'eligible_set_count' => (int) $group->set_count,
                'set_percentage' => $this->percentage((int) $group->set_count, $denominator),
            ];
        }

        return [
            'number_occurrence_count' => $even + $odd,
            'occurrence_share_percentage_denominator' => 'number_occurrence_count',
            'set_percentage_denominator' => 'eligible_set_count',
            'even' => ['count' => $even, 'occurrence_share_percentage' => $this->percentage($even, $even + $odd)],
            'odd' => ['count' => $odd, 'occurrence_share_percentage' => $this->percentage($odd, $even + $odd)],
            'distribution' => $distribution,
        ];
    }

    /** @return list<array<string, int|float>> */
    private function pairs(Builder $sets, int $denominator, int $limit): array
    {
        return (clone $sets)
            ->join('drawing_numbers as a', 'a.drawing_set_id', '=', 's.id')
            ->join('drawing_numbers as b', function (JoinClause $join): void {
                $join->on('b.drawing_set_id', '=', 'a.drawing_set_id')->on('a.number', '<', 'b.number');
            })->selectRaw('a.number as first_number, b.number as second_number, COUNT(*) as frequency')
            ->groupBy('a.number', 'b.number')->orderByDesc('frequency')->orderBy('a.number')->orderBy('b.number')
            ->limit($limit)->get()->map(fn ($row): array => [
                'first_number' => (int) $row->first_number,
                'second_number' => (int) $row->second_number,
                'count' => (int) $row->frequency,
                'occurrence_percentage' => $this->percentage((int) $row->frequency, $denominator),
            ])->all();
    }

    /**
     * @param  list<string>  $types
     * @return list<array<string, int|float>>
     */
    private function yearly(Builder $drawings, array $types, ?int $number): array
    {
        $query = (clone $drawings)->leftJoin('drawing_sets as s', function (JoinClause $join) use ($types): void {
            $join->on('s.drawing_id', '=', 'd.id')->whereIn('s.type', $types);
        })->leftJoin('drawing_numbers as n', 'n.drawing_set_id', '=', 's.id')
            ->selectRaw('d.year, COUNT(DISTINCT d.id) as drawing_count, COUNT(DISTINCT s.id) as eligible_set_count,
                COUNT(n.id) as number_occurrence_count')->groupBy('d.year')->orderBy('d.year');
        if ($number !== null) {
            $query->selectRaw('SUM(CASE WHEN n.number = ? THEN 1 ELSE 0 END) as selected_number_count', [$number]);
        }

        return $query->get()->map(function ($row) use ($number): array {
            $result = [
                'year' => (int) $row->year,
                'drawing_count' => (int) $row->drawing_count,
                'eligible_set_count' => (int) $row->eligible_set_count,
                'number_occurrence_count' => (int) $row->number_occurrence_count,
            ];
            if ($number !== null) {
                $result['selected_number_count'] = (int) $row->selected_number_count;
                $result['selected_number_occurrence_percentage'] = $this->percentage((int) $row->selected_number_count, (int) $row->eligible_set_count);
            }

            return $result;
        })->all();
    }

    private function percentage(int $count, int $denominator): float
    {
        return $denominator === 0 ? 0.0 : round($count / $denominator * 100, 2);
    }
}
