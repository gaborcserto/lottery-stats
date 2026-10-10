<?php

namespace App\Lottery;

use App\Models\Drawing;
use App\Models\DrawingNumber;
use App\Models\DrawingPrize;
use App\Models\Game;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

final class LotteryDrawingPersister
{
    /**
     * Persist one complete, already-validated normalized batch. Synchronization
     * status and timestamps belong to the caller, after remote synchronization.
     *
     * @param  list<NormalizedDrawing>  $drawings
     */
    public function persist(string $gameCode, array $drawings): LotteryPersistenceResult
    {
        $keys = [];

        if ($drawings === []) {
            throw new InvalidArgumentException('Persistence requires a non-empty normalized batch.');
        }

        foreach ($drawings as $drawing) {
            if ($drawing->gameCode !== $gameCode) {
                throw new InvalidArgumentException('Every drawing must belong to the requested game.');
            }

            if (isset($keys[$drawing->sourceKey])) {
                throw new InvalidArgumentException('The normalized batch contains a duplicate source identity.');
            }

            $keys[$drawing->sourceKey] = true;
        }

        return DB::transaction(function () use ($gameCode, $drawings): LotteryPersistenceResult {
            // A write before any reads acquires SQLite's database-wide writer lock,
            // including inside a caller's transaction. Do not change game metadata.
            Game::query()->where('code', $gameCode)->toBase()->update(['code' => $gameCode]);
            $game = Game::query()->where('code', $gameCode)->firstOrFail();
            $existing = $game->drawings()->with(['sets.numbers', 'prizes'])->get()->keyBy('source_key');
            $datedKeys = [];

            foreach ($existing as $drawing) {
                $storedDate = $this->storedDate($drawing);
                if ($storedDate !== null) {
                    $datedKeys[$storedDate][] = $drawing->source_key;
                }
            }

            $inserted = $updated = $unchanged = 0;

            foreach ($drawings as $normalized) {
                $drawing = $existing->get($normalized->sourceKey);
                $date = $normalized->drawnOn?->format('Y-m-d');
                $sets = $this->normalizedSets($normalized);
                $prizes = $this->normalizedPrizes($normalized);

                if ($date !== null && isset($datedKeys[$date]) && $datedKeys[$date] !== [$normalized->sourceKey]) {
                    throw new RuntimeException('A stored drawing has the same date under a different source identity.');
                }

                if ($drawing !== null) {
                    $storedSets = $this->storedSets($drawing);

                    if ($this->storedDate($drawing) !== $date
                        || ($date === null && ($drawing->year !== $normalized->year
                            || $drawing->week !== $normalized->week || $storedSets !== $sets))) {
                        throw new RuntimeException('A stored drawing conflicts with the normalized source identity.');
                    }

                    if ($drawing->year === $normalized->year && $drawing->week === $normalized->week
                        && $storedSets === $sets && $this->storedPrizes($drawing) === $prizes) {
                        $unchanged++;

                        continue;
                    }

                    $drawing->update(['year' => $normalized->year, 'week' => $normalized->week]);
                    // Cascading foreign keys remove numbers belonging to replaced sets.
                    $drawing->sets()->delete();
                    $drawing->prizes()->delete();
                    $updated++;
                } else {
                    $drawing = $game->drawings()->create([
                        'source_key' => $normalized->sourceKey,
                        'year' => $normalized->year,
                        'week' => $normalized->week,
                        'drawn_on' => $date,
                    ]);
                    $inserted++;
                }

                $this->persistChildren($drawing, $normalized);
            }

            return new LotteryPersistenceResult($inserted, $updated, $unchanged);
        });
    }

    /** @return array<string, list<int>> */
    private function normalizedSets(NormalizedDrawing $drawing): array
    {
        $sets = [];

        foreach ($drawing->numberSets as $set) {
            $numbers = $set->numbers;
            sort($numbers, SORT_NUMERIC);
            $sets[$set->type] = $numbers;
        }

        ksort($sets);

        return $sets;
    }

    private function storedDate(Drawing $drawing): ?string
    {
        /** @var ?CarbonInterface $date */
        $date = $drawing->getAttribute('drawn_on');

        return $date?->format('Y-m-d');
    }

    /** @return array<string, list<int>> */
    private function storedSets(Drawing $drawing): array
    {
        $sets = [];

        foreach ($drawing->sets as $set) {
            $sets[$set->type] = $set->numbers->sortBy('number')->pluck('number')->all();
        }

        ksort($sets);

        return $sets;
    }

    /** @return array<string, array{?int, ?string, ?string}> */
    private function normalizedPrizes(NormalizedDrawing $drawing): array
    {
        $prizes = [];

        foreach ($drawing->prizes as $prize) {
            $prizes[$prize->tier] = [$prize->winnerCount, $prize->amount, $prize->currency];
        }

        ksort($prizes);

        return $prizes;
    }

    /** @return array<string, array{?int, ?string, ?string}> */
    private function storedPrizes(Drawing $drawing): array
    {
        $prizes = [];

        foreach ($drawing->prizes as $prize) {
            // The model's decimal:2 cast returns a string, despite SQLite's numeric affinity.
            /** @var ?string $amount */
            $amount = $prize->getAttribute('amount');
            $prizes[$prize->tier] = [$prize->winner_count, $amount, $prize->currency];
        }

        ksort($prizes);

        return $prizes;
    }

    private function persistChildren(Drawing $drawing, NormalizedDrawing $normalized): void
    {
        $timestamp = now();
        $numbers = [];

        foreach ($normalized->numberSets as $set) {
            $storedSet = $drawing->sets()->create(['type' => $set->type]);

            foreach ($set->numbers as $number) {
                $numbers[] = [
                    'drawing_set_id' => $storedSet->id,
                    'number' => $number,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ];
            }
        }

        if ($numbers !== []) {
            DrawingNumber::query()->insert($numbers);
        }

        $prizes = [];

        foreach ($normalized->prizes as $prize) {
            $prizes[] = [
                'drawing_id' => $drawing->id,
                'tier' => $prize->tier,
                'winner_count' => $prize->winnerCount,
                'amount' => $prize->amount,
                'currency' => $prize->currency,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        if ($prizes !== []) {
            DrawingPrize::query()->insert($prizes);
        }
    }
}
