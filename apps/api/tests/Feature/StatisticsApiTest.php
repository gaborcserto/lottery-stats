<?php

namespace Tests\Feature;

use App\Models\Game;
use Database\Seeders\GameSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StatisticsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        Http::preventStrayRequests();
        $this->seed(GameSeeder::class);
    }

    public function test_summary_counts_drawings_once_and_reports_known_and_missing_dates(): void
    {
        $this->fiveDrawings();

        $this->getJson($this->url('five', 'summary'))->assertOk()->assertExactJson([
            'data' => [
                'drawing_count' => 3, 'eligible_set_count' => 3,
                'min_year' => 2000, 'max_year' => 2025,
                'from_date' => '2025-03-01', 'to_date' => '2025-03-08', 'undated_drawing_count' => 1,
            ],
            'meta' => [
                'game' => 'five', 'filters' => [], 'set_scope' => 'main',
                'drawing_count' => 3, 'eligible_set_count' => 3, 'percentage_precision' => 2,
            ],
        ]);
        // Even when both Scandinavian sets are selected, the drawing count stays two.
        $this->scandinavianDrawings();
        $this->getJson($this->url('scandinavian', 'summary', 'set=combined'))->assertOk()
            ->assertJsonPath('data.drawing_count', 2)->assertJsonPath('data.eligible_set_count', 4)
            ->assertJsonPath('data.undated_drawing_count', 1);
    }

    public function test_five_frequencies_use_sets_not_balls_and_include_the_entire_range(): void
    {
        $this->fiveDrawings();

        $response = $this->getJson($this->url('five', 'frequencies'))->assertOk()->assertJsonCount(90, 'data')
            ->assertJsonPath('data.0', ['number' => 1, 'count' => 2, 'occurrence_percentage' => 66.67])
            ->assertJsonPath('data.1', ['number' => 2, 'count' => 3, 'occurrence_percentage' => 100])
            ->assertJsonPath('data.89', ['number' => 90, 'count' => 0, 'occurrence_percentage' => 0])
            ->assertJsonPath('meta.occurrence_percentage_denominator', 'eligible_set_count');
        $this->assertSame(15, array_sum(array_column($response->json('data'), 'count')));
    }

    public function test_six_excludes_bonus_from_all_aggregations(): void
    {
        $this->drawing('six', 2000, 1, null, ['main' => range(1, 6), 'bonus' => [45]]);
        $this->drawing('six', 2025, 10, '2025-03-01', ['main' => [1, 3, 5, 7, 9, 11], 'bonus' => [2]]);
        $response = $this->getJson($this->url('six', 'frequencies'))->assertOk()->assertJsonCount(45, 'data')
            ->assertJsonPath('meta.eligible_set_count', 2)
            ->assertJsonPath('data.1.count', 1)->assertJsonPath('data.1.occurrence_percentage', 50)
            ->assertJsonPath('data.44.count', 0);
        $this->assertSame(12, array_sum(array_column($response->json('data'), 'count')));
        $this->getJson($this->url('six', 'parity'))->assertOk()
            ->assertJsonPath('data.number_occurrence_count', 12)
            ->assertJsonPath('data.even.count', 3)->assertJsonPath('data.odd.count', 9);
        $pairs = $this->getJson($this->url('six', 'pairs', 'limit=100'))->assertOk()->json('data');
        $this->assertSame(30, array_sum(array_column($pairs, 'count')));
        $this->assertNotContains(45, array_column($pairs, 'second_number'));
        $this->getJson($this->url('six', 'trends/yearly', 'number=45'))->assertOk()
            ->assertJsonPath('data.0.selected_number_count', 0)
            ->assertJsonPath('data.0.number_occurrence_count', 6);
    }

    public function test_scandinavian_scopes_preserve_overlapping_occurrences(): void
    {
        $this->scandinavianDrawings();

        $this->getJson($this->url('scandinavian', 'frequencies'))->assertOk()
            ->assertJsonPath('meta.set_scope', 'machine')->assertJsonPath('meta.eligible_set_count', 2)
            ->assertJsonPath('data.0.count', 2)->assertJsonPath('data.0.occurrence_percentage', 100);
        $this->getJson($this->url('scandinavian', 'frequencies', 'set=manual'))->assertOk()
            ->assertJsonPath('meta.eligible_set_count', 2)
            ->assertJsonPath('data.0.count', 1)->assertJsonPath('data.0.occurrence_percentage', 50);
        $response = $this->getJson($this->url('scandinavian', 'frequencies', 'set=combined'))->assertOk()
            ->assertJsonCount(35, 'data')->assertJsonPath('meta.drawing_count', 2)
            ->assertJsonPath('meta.eligible_set_count', 4)
            ->assertJsonPath('data.0.count', 3)->assertJsonPath('data.0.occurrence_percentage', 75)
            ->assertJsonPath('data.1.count', 3)->assertJsonPath('data.1.occurrence_percentage', 75);
        $this->assertSame(28, array_sum(array_column($response->json('data'), 'count')));
    }

    public function test_rankings_include_zero_counts_and_break_ties_by_number(): void
    {
        $this->fiveDrawings();
        $this->getJson($this->url('five', 'frequencies', 'sort=most&limit=3'))->assertOk()
            ->assertJsonCount(3, 'data')->assertJsonPath('data.0.number', 2)
            ->assertJsonPath('data.1.number', 1)->assertJsonPath('data.2.number', 3);
        $this->getJson($this->url('five', 'frequencies', 'sort=least&limit=2'))->assertOk()
            ->assertJsonPath('data.0.number', 12)->assertJsonPath('data.0.count', 0)
            ->assertJsonPath('data.1.number', 13);
        $this->getJson($this->url('five', 'frequencies', 'sort=most'))->assertJsonCount(10, 'data');
        $this->getJson($this->url('five', 'frequencies', 'limit=2'))->assertJsonPath('data.1.number', 2);
    }

    public function test_parity_reports_occurrence_shares_and_set_distributions(): void
    {
        $this->fiveDrawings();
        $this->getJson($this->url('five', 'parity'))->assertOk()
            ->assertJsonPath('data.number_occurrence_count', 15)
            ->assertJsonPath('data.even', ['count' => 7, 'occurrence_share_percentage' => 46.67])
            ->assertJsonPath('data.odd', ['count' => 8, 'occurrence_share_percentage' => 53.33])
            ->assertJsonPath('data.distribution', [
                ['even_count' => 1, 'odd_count' => 4, 'eligible_set_count' => 1, 'set_percentage' => 33.33],
                ['even_count' => 2, 'odd_count' => 3, 'eligible_set_count' => 1, 'set_percentage' => 33.33],
                ['even_count' => 4, 'odd_count' => 1, 'eligible_set_count' => 1, 'set_percentage' => 33.33],
            ]);
        $this->scandinavianDrawings();
        $this->getJson($this->url('scandinavian', 'parity', 'set=machine'))->assertJsonPath('data.even.count', 3);
        $this->getJson($this->url('scandinavian', 'parity', 'set=manual'))->assertJsonPath('data.even.count', 11);
        $this->getJson($this->url('scandinavian', 'parity', 'set=combined'))->assertOk()
            ->assertJsonPath('data.even.count', 14)->assertJsonPath('data.odd.count', 14)
            ->assertJsonPath('data.even.occurrence_share_percentage', 50)
            ->assertJsonCount(4, 'data.distribution');
    }

    public function test_pairs_are_unordered_and_never_cross_sets(): void
    {
        $this->fiveDrawings();
        $response = $this->getJson($this->url('five', 'pairs', 'limit=100'))->assertOk()
            ->assertJsonPath('data.0', ['first_number' => 1, 'second_number' => 2, 'count' => 2, 'occurrence_percentage' => 66.67])
            ->assertJsonPath('data.1', ['first_number' => 2, 'second_number' => 3, 'count' => 2, 'occurrence_percentage' => 66.67]);
        $this->assertSame(30, array_sum(array_column($response->json('data'), 'count')));
        foreach ($response->json('data') as $pair) {
            $this->assertLessThan($pair['second_number'], $pair['first_number']);
        }
        $this->scandinavianDrawings();
        $pairs = $this->getJson($this->url('scandinavian', 'pairs', 'set=combined&limit=100'))->assertOk()
            ->assertJsonPath('meta.eligible_set_count', 4)->json('data');
        $this->assertSame(84, array_sum(array_column($pairs, 'count')));
        $this->assertContains(['first_number' => 1, 'second_number' => 2, 'count' => 2, 'occurrence_percentage' => 50], $pairs);
        $this->assertCount(0, array_filter($pairs, fn (array $pair): bool => $pair['first_number'] === 7 && $pair['second_number'] === 12));
        $machinePairs = $this->getJson($this->url('scandinavian', 'pairs', 'set=machine&limit=100'))->json('data');
        $manualPairs = $this->getJson($this->url('scandinavian', 'pairs', 'set=manual&limit=100'))->json('data');
        $this->assertSame(42, array_sum(array_column($machinePairs, 'count')));
        $this->assertSame(42, array_sum(array_column($manualPairs, 'count')));
        $this->getJson($this->url('five', 'pairs', 'limit=1'))->assertJsonCount(1, 'data');
    }

    public function test_yearly_trends_include_source_years_and_optional_number_without_narrowing_population(): void
    {
        $this->fiveDrawings();
        $this->getJson($this->url('five', 'trends/yearly'))->assertOk()->assertJsonPath('data', [
            ['year' => 2000, 'drawing_count' => 1, 'eligible_set_count' => 1, 'number_occurrence_count' => 5],
            ['year' => 2025, 'drawing_count' => 2, 'eligible_set_count' => 2, 'number_occurrence_count' => 10],
        ]);
        $this->getJson($this->url('five', 'trends/yearly', 'number=1'))->assertOk()
            ->assertJsonPath('data.0.selected_number_count', 1)
            ->assertJsonPath('data.0.selected_number_occurrence_percentage', 100)
            ->assertJsonPath('data.1.selected_number_count', 1)
            ->assertJsonPath('data.1.selected_number_occurrence_percentage', 50)
            ->assertJsonPath('data.1.number_occurrence_count', 10);
        $this->scandinavianDrawings();
        $this->getJson($this->url('scandinavian', 'trends/yearly', 'set=combined&number=1'))->assertOk()
            ->assertJsonPath('data.0.drawing_count', 1)->assertJsonPath('data.0.eligible_set_count', 2)
            ->assertJsonPath('data.0.number_occurrence_count', 14)
            ->assertJsonPath('data.0.selected_number_count', 2)
            ->assertJsonPath('data.0.selected_number_occurrence_percentage', 100)
            ->assertJsonPath('data.1.selected_number_occurrence_percentage', 50);
    }

    public function test_all_metrics_apply_year_week_and_inclusive_date_filters_consistently(): void
    {
        $this->fiveDrawings();
        foreach (['summary', 'frequencies', 'parity', 'pairs', 'trends/yearly'] as $metric) {
            $this->getJson($this->url('five', $metric, 'year=2000&week=10'))->assertOk()
                ->assertJsonPath('meta.drawing_count', 1)->assertJsonPath('meta.eligible_set_count', 1)
                ->assertJsonPath('meta.filters', ['year' => 2000, 'week' => 10]);
            $this->getJson($this->url('five', $metric, 'from_date=2025-03-01&to_date=2025-03-01'))->assertOk()
                ->assertJsonPath('meta.drawing_count', 1)->assertJsonPath('meta.eligible_set_count', 1);
            $this->getJson($this->url('five', $metric, 'to_date=2025-03-08'))->assertOk()
                ->assertJsonPath('meta.drawing_count', 2);
            $this->getJson($this->url('five', $metric, 'from_date=2025-03-08'))->assertOk()
                ->assertJsonPath('meta.drawing_count', 1);
            $this->getJson($this->url('five', $metric, 'year=2000&from_date=2025-03-01'))->assertOk()
                ->assertJsonPath('meta.drawing_count', 0);
        }
        $this->getJson($this->url('five', 'frequencies', 'year=2000&week=10'))->assertJsonPath('data.0.count', 1);
        $this->getJson($this->url('five', 'parity', 'year=2000'))->assertJsonPath('data.number_occurrence_count', 5);
        $this->getJson($this->url('five', 'pairs', 'year=2000&limit=100'))->assertJsonCount(10, 'data');
        $this->getJson($this->url('five', 'trends/yearly', 'week=11'))->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.number_occurrence_count', 5);
    }

    public function test_empty_populations_have_stable_zero_and_null_representations(): void
    {
        $summary = $this->getJson($this->url('five', 'summary'))->assertOk()
            ->assertJsonPath('data.drawing_count', 0)->assertJsonPath('data.eligible_set_count', 0)
            ->assertJsonPath('data.min_year', null)->assertJsonPath('data.max_year', null)
            ->assertJsonPath('data.from_date', null)->assertJsonPath('data.to_date', null)
            ->assertJsonPath('data.undated_drawing_count', 0);
        $this->assertStringContainsString('"filters":{}', $summary->getContent());
        $this->getJson($this->url('five', 'frequencies'))->assertOk()->assertJsonCount(90, 'data')
            ->assertJsonPath('data.0.count', 0)->assertJsonPath('data.0.occurrence_percentage', 0);
        $this->getJson($this->url('five', 'parity'))->assertOk()->assertJsonPath('data.distribution', [])
            ->assertJsonPath('data.even.count', 0)->assertJsonPath('data.even.occurrence_share_percentage', 0)
            ->assertJsonPath('data.odd.count', 0)->assertJsonPath('data.odd.occurrence_share_percentage', 0);
        $this->getJson($this->url('five', 'pairs'))->assertOk()->assertJsonPath('data', []);
        $this->getJson($this->url('five', 'trends/yearly', 'number=1'))->assertOk()->assertJsonPath('data', []);
        $this->getJson($this->url('five', 'frequencies', 'sort=least&limit=2'))
            ->assertJsonPath('data.0.number', 1)->assertJsonPath('data.1.number', 2);
    }

    public function test_denominators_count_actual_selected_sets_independently_of_drawings(): void
    {
        $this->drawing('scandinavian', 2000, 1, null, ['manual' => range(1, 7)]);
        $this->getJson($this->url('scandinavian', 'summary', 'set=machine'))->assertOk()
            ->assertJsonPath('data.drawing_count', 1)->assertJsonPath('data.eligible_set_count', 0);
        $this->getJson($this->url('scandinavian', 'frequencies', 'set=machine'))
            ->assertJsonPath('data.0.count', 0)->assertJsonPath('data.0.occurrence_percentage', 0);
        $this->getJson($this->url('scandinavian', 'trends/yearly', 'set=machine&number=1'))
            ->assertJsonPath('data.0.drawing_count', 1)->assertJsonPath('data.0.eligible_set_count', 0)
            ->assertJsonPath('data.0.number_occurrence_count', 0)
            ->assertJsonPath('data.0.selected_number_occurrence_percentage', 0);
        $this->getJson($this->url('scandinavian', 'summary', 'set=combined'))
            ->assertJsonPath('data.eligible_set_count', 1);
    }

    #[DataProvider('invalidQueries')]
    public function test_invalid_queries_return_json_validation_errors(string $game, string $metric, string $query, string $field): void
    {
        $this->get($this->url($game, $metric, $query))->assertUnprocessable()
            ->assertHeader('Content-Type', 'application/json')->assertJsonValidationErrors($field)
            ->assertJsonStructure(['message', 'errors']);
    }

    /** @return list<array{string, string, string, string}> */
    public static function invalidQueries(): array
    {
        return [
            ['five', 'summary', 'year=0', 'year'],
            ['five', 'summary', 'year=10000', 'year'],
            ['five', 'summary', 'year=abc', 'year'],
            ['five', 'summary', 'week=54', 'week'],
            ['five', 'summary', 'week=0', 'week'],
            ['five', 'summary', 'week=1.5', 'week'],
            ['five', 'summary', 'year[]=2000', 'year'],
            ['five', 'summary', 'from_date=2025-02-30', 'from_date'],
            ['five', 'summary', 'to_date=bad', 'to_date'],
            ['five', 'summary', 'from_date=2025-03-08&to_date=2025-03-01', 'to_date'],
            ['five', 'summary', 'unknown=1', 'unknown'],
            ['five', 'summary', 'limit=5', 'limit'],
            ['five', 'summary', 'set=machine', 'set'],
            ['six', 'frequencies', 'set=bonus', 'set'],
            ['scandinavian', 'frequencies', 'set=main', 'set'],
            ['scandinavian', 'summary', 'set[]=machine', 'set'],
            ['five', 'frequencies', 'sort=random', 'sort'],
            ['five', 'frequencies', 'limit=91', 'limit'],
            ['five', 'frequencies', 'limit=0', 'limit'],
            ['five', 'frequencies', 'limit=1.5', 'limit'],
            ['five', 'pairs', 'limit=101', 'limit'],
            ['five', 'pairs', 'limit=0', 'limit'],
            ['five', 'pairs', 'sort=least', 'sort'],
            ['five', 'parity', 'number=1', 'number'],
            ['five', 'trends/yearly', 'number=0', 'number'],
            ['five', 'trends/yearly', 'number=91', 'number'],
            ['six', 'trends/yearly', 'number=46', 'number'],
            ['scandinavian', 'trends/yearly', 'number=36', 'number'],
            ['five', 'trends/yearly', 'number=abc', 'number'],
            ['five', 'trends/yearly', 'number[]=1', 'number'],
        ];
    }

    public function test_unknown_games_return_json_404_before_filter_validation(): void
    {
        foreach (['summary', 'frequencies', 'parity', 'pairs', 'trends/yearly'] as $metric) {
            $this->get($this->url('unknown', $metric, 'year=bad'))->assertNotFound()
                ->assertHeader('Content-Type', 'application/json')->assertJsonStructure(['message']);
        }
    }

    public function test_endpoints_use_bounded_aggregate_queries_and_are_read_only(): void
    {
        $this->fiveDrawings();
        foreach (['summary', 'frequencies', 'parity', 'pairs', 'trends/yearly'] as $metric) {
            DB::enableQueryLog();
            DB::flushQueryLog();
            $this->getJson($this->url('five', $metric))->assertOk();
            $queries = DB::getQueryLog();
            DB::disableQueryLog();
            $this->assertCount($metric === 'summary' ? 2 : 3, $queries);
            foreach ($queries as $query) {
                $this->assertStringStartsWith('select ', $query['query']);
            }
            $this->assertStringContainsString('COUNT(', $queries[1]['query']);
        }
        Http::assertNothingSent();
    }

    private function fiveDrawings(): void
    {
        $this->drawing('five', 2000, 10, null, ['main' => [1, 2, 3, 4, 5]]);
        $this->drawing('five', 2025, 10, '2025-03-01', ['main' => [1, 2, 6, 8, 10]]);
        $this->drawing('five', 2025, 11, '2025-03-08', ['main' => [2, 3, 7, 9, 11]]);
    }

    private function scandinavianDrawings(): void
    {
        $this->drawing('scandinavian', 2000, 10, null, ['machine' => range(1, 7), 'manual' => [1, 2, 8, 9, 10, 11, 12]]);
        $this->drawing('scandinavian', 2025, 10, '2025-03-01', ['machine' => [1, 3, 5, 7, 9, 11, 13], 'manual' => [2, 4, 6, 8, 10, 12, 14]]);
    }

    /** @param array<string, list<int>> $sets */
    private function drawing(string $code, int $year, int $week, ?string $date, array $sets): void
    {
        $game = Game::query()->where('code', $code)->firstOrFail();
        $drawing = $game->drawings()->create([
            'source_key' => 'fixture-'.$game->drawings()->count(),
            'year' => $year, 'week' => $week, 'drawn_on' => $date,
        ]);
        foreach ($sets as $type => $numbers) {
            $set = $drawing->sets()->create(['type' => $type]);
            $set->numbers()->createMany(array_map(fn (int $number): array => ['number' => $number], $numbers));
        }
    }

    private function url(string $game, string $metric, string $query = ''): string
    {
        return '/api/v1/games/'.$game.'/statistics/'.$metric.($query === '' ? '' : '?'.$query);
    }
}
