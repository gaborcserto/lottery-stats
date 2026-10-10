<?php

namespace Tests\Feature;

use App\Lottery\LotteryDrawingPersister;
use App\Lottery\LotteryPayloadNormalizer;
use App\Lottery\LotteryPersistenceResult;
use App\Lottery\NormalizedDrawing;
use App\Lottery\NormalizedNumberSet;
use App\Lottery\NormalizedPrizeTier;
use App\Models\Drawing;
use App\Models\DrawingPrize;
use App\Models\Game;
use Database\Seeders\GameSeeder;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class LotteryDrawingPersisterTest extends TestCase
{
    use RefreshDatabase;

    private LotteryDrawingPersister $persister;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        Http::preventStrayRequests();
        $this->seed(GameSeeder::class);
        $this->persister = new LotteryDrawingPersister;
    }

    public function test_first_import_and_identical_reimport_preserve_all_rows(): void
    {
        $batch = [$this->drawing()];
        $this->assertCounts($this->persister->persist('five', $batch), 1, 0, 0);
        $before = $this->snapshot();
        $this->travel(1)->hour();
        $this->assertCounts($this->persister->persist('five', $batch), 0, 0, 1);
        $this->assertSame($before, $this->snapshot());
        $this->assertDatabaseCount('drawings', 1);
        $this->assertDatabaseCount('drawing_sets', 1);
        $this->assertDatabaseCount('drawing_numbers', 5);
        $this->assertDatabaseHas('drawing_prizes', ['tier' => 'match_5', 'winner_count' => 1, 'currency' => 'HUF']);
    }

    public function test_corrected_prizes_and_numbers_update_the_same_parent_without_stale_children(): void
    {
        $this->persister->persist('five', [$this->drawing()]);
        $parent = Drawing::query()->firstOrFail();
        $createdAt = $parent->getRawOriginal('created_at');
        $corrected = $this->drawing(
            sets: [new NormalizedNumberSet('main', [6, 7, 8, 9, 10])],
            prizes: [new NormalizedPrizeTier('match_4', 2, '234567890123.00', 'HUF')],
        );
        $this->assertCounts($this->persister->persist('five', [$corrected]), 0, 1, 0);
        $this->assertSame($parent->id, Drawing::query()->firstOrFail()->id);
        $this->assertSame($createdAt, $parent->refresh()->getRawOriginal('created_at'));
        $this->assertDatabaseCount('drawing_numbers', 5);
        $this->assertDatabaseMissing('drawing_numbers', ['number' => 1]);
        $this->assertDatabaseMissing('drawing_prizes', ['tier' => 'match_5']);
        $this->assertSame('234567890123.00', DrawingPrize::query()->firstOrFail()->amount);
        $this->assertCounts($this->persister->persist('five', [$corrected]), 0, 0, 1);
    }

    public function test_prize_only_correction_and_mixed_result_counts(): void
    {
        $first = $this->drawing();
        $second = $this->drawing(date: '2026-10-04');
        $this->persister->persist('five', [$first, $second]);
        $corrected = $this->drawing(prizes: [new NormalizedPrizeTier('match_5', 3, '987654321.00', 'HUF')]);
        $this->assertCounts($this->persister->persist('five', [$corrected, $second, $this->drawing(date: '2026-10-05')]), 1, 1, 1);
        $this->assertSame('987654321.00', Drawing::query()->where('source_key', $first->sourceKey)->firstOrFail()->prizes->first()->amount);
    }

    public function test_absent_history_and_other_games_are_preserved_with_multiple_same_week_drawings(): void
    {
        $historical = $this->drawing(date: null);
        $this->persister->persist('five', [$historical, $this->drawing()]);
        $this->persister->persist('six', [$this->drawing(game: 'six', sets: [new NormalizedNumberSet('main', [1, 2, 3, 4, 5, 6])])]);
        $before = DB::table('drawings')->where('source_key', $historical->sourceKey)->first();
        $this->assertCounts($this->persister->persist('five', [$this->drawing(date: '2026-10-04')]), 1, 0, 0);
        $this->assertDatabaseCount('drawings', 4);
        $this->assertEquals($before, DB::table('drawings')->where('source_key', $historical->sourceKey)->first());
        $this->assertNull(Drawing::query()->where('source_key', $historical->sourceKey)->firstOrFail()->drawn_on);
    }

    public function test_six_bonus_can_be_added_and_removed_without_leaving_stale_sets_or_prizes(): void
    {
        $main = new NormalizedNumberSet('main', [1, 2, 3, 4, 5, 6]);
        $without = $this->drawing(game: 'six', sets: [$main], prizes: []);
        $with = $this->drawing(game: 'six', sets: [$main, new NormalizedNumberSet('bonus', [7])],
            prizes: [new NormalizedPrizeTier('match_5_plus_1', 1, '29525700.00', 'HUF')]);
        $this->persister->persist('six', [$without]);
        $this->assertCounts($this->persister->persist('six', [$with]), 0, 1, 0);
        $drawing = Drawing::query()->with('sets.numbers')->firstOrFail();
        $this->assertSame([7], $drawing->sets->firstWhere('type', 'bonus')->numbers->pluck('number')->all());
        $this->assertSame([1, 2, 3, 4, 5, 6], $drawing->sets->firstWhere('type', 'main')->numbers->pluck('number')->all());
        $this->assertCounts($this->persister->persist('six', [$without]), 0, 1, 0);
        $this->assertDatabaseCount('drawing_sets', 1);
        $this->assertDatabaseCount('drawing_numbers', 6);
        $this->assertDatabaseCount('drawing_prizes', 0);
    }

    public function test_scandinavian_sets_remain_distinct_and_allow_overlap(): void
    {
        $batch = [$this->drawing(game: 'scandinavian', sets: [
            new NormalizedNumberSet('machine', [1, 2, 3, 4, 5, 6, 7]),
            new NormalizedNumberSet('manual', [7, 8, 9, 10, 11, 12, 13]),
        ], prizes: [])];
        $this->assertCounts($this->persister->persist('scandinavian', $batch), 1, 0, 0);
        $drawing = Drawing::query()->with('sets.numbers')->firstOrFail();
        $this->assertSame([1, 2, 3, 4, 5, 6, 7], $drawing->sets->firstWhere('type', 'machine')->numbers->pluck('number')->all());
        $this->assertSame([7, 8, 9, 10, 11, 12, 13], $drawing->sets->firstWhere('type', 'manual')->numbers->pluck('number')->all());
        $this->assertCounts($this->persister->persist('scandinavian', $batch), 0, 0, 1);
    }

    public function test_nullable_prizes_and_exact_decimal_strings_round_trip(): void
    {
        $batch = [$this->drawing(prizes: [
            new NormalizedPrizeTier('match_2', null, null, null),
            new NormalizedPrizeTier('match_3', 0, '0.00', 'HUF'),
            new NormalizedPrizeTier('match_4', null, '999999999999.00', 'HUF'),
            new NormalizedPrizeTier('match_5', 4294967295, null, null),
        ])];
        $this->persister->persist('five', $batch);
        $prizes = DrawingPrize::query()->get()->keyBy('tier');
        $this->assertNull($prizes['match_2']->amount);
        $this->assertNull($prizes['match_2']->winner_count);
        $this->assertNull($prizes['match_2']->currency);
        $this->assertSame('0.00', $prizes['match_3']->amount);
        $this->assertSame('999999999999.00', $prizes['match_4']->amount);
        $this->assertSame(4294967295, $prizes['match_5']->winner_count);
        $this->assertSame('integer', DB::table('drawing_prizes')->where('tier', 'match_4')->selectRaw('typeof(amount) AS storage_type')->first()->storage_type);
        $this->assertCounts($this->persister->persist('five', $batch), 0, 0, 1);
    }

    public function test_normalized_historical_zero_vectors_remain_unknown(): void
    {
        foreach (['five' => [1, 2, 3, 4, 5], 'six' => [1, 2, 3, 4, 5, 6, 7]] as $game => $numbers) {
            $record = ['year' => 1990, 'week' => 1, 'date' => '', 'numbers' => $numbers];
            $tiers = $game === 'five' ? ['2', '3', '4', '5'] : ['3', '4', '5', '5P1', '6'];
            foreach ($tiers as $tier) {
                $record[$tier.'HitCount'] = 0;
                $record[$tier.'HitPrize'] = '0 Ft';
            }
            $batch = (new LotteryPayloadNormalizer)->normalize($game, ['drawings' => [$record]]);
            $this->persister->persist($game, $batch);
        }
        $this->assertDatabaseCount('drawing_prizes', 9);
        foreach (DrawingPrize::query()->get() as $prize) {
            $this->assertNull($prize->winner_count);
            $this->assertNull($prize->amount);
            $this->assertNull($prize->currency);
        }
    }

    public function test_changed_undated_keys_and_added_dates_are_inserted_without_reconciliation(): void
    {
        $first = $this->drawing(date: null);
        $changed = $this->drawing(date: null, sets: [new NormalizedNumberSet('main', [6, 7, 8, 9, 10])]);
        $this->persister->persist('five', [$first]);
        $this->assertCounts($this->persister->persist('five', [$changed, $this->drawing()]), 2, 0, 0);
        $this->assertDatabaseCount('drawings', 3);
        $this->assertDatabaseHas('drawings', ['source_key' => $first->sourceKey, 'drawn_on' => null]);
    }

    public function test_wrong_game_and_duplicate_batch_identities_are_rejected_without_writes(): void
    {
        foreach ([[$this->drawing(), $this->drawing(game: 'six')], [$this->drawing(), $this->drawing(prizes: [])], []] as $batch) {
            try {
                $this->persister->persist('five', $batch);
                $this->fail('Invalid batches must fail.');
            } catch (InvalidArgumentException) {
                $this->assertDatabaseCount('drawings', 0);
            }
        }
    }

    public function test_unknown_game_is_not_created(): void
    {
        $this->expectException(ModelNotFoundException::class);
        $this->persister->persist('unknown', [$this->drawing(game: 'unknown')]);
    }

    public function test_stored_identity_conflict_rolls_back_earlier_batch_writes(): void
    {
        $first = $this->drawing(date: null);
        $this->persister->persist('five', [$first]);
        // Simulate corrupt stored identity metadata; the importer must not silently merge it.
        Drawing::query()->update(['week' => 41]);
        $before = $this->snapshot();
        try {
            $this->persister->persist('five', [$this->drawing(), $first]);
            $this->fail('Stored identity conflicts must fail.');
        } catch (RuntimeException) {
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_same_date_under_a_different_stored_key_is_rejected(): void
    {
        $this->persister->persist('five', [$this->drawing()]);
        Drawing::query()->update(['source_key' => 'legacy-key']);
        $before = $this->snapshot();
        try {
            $this->persister->persist('five', [$this->drawing()]);
            $this->fail('Ambiguous dated identities must fail.');
        } catch (RuntimeException) {
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_existing_duplicate_dates_are_not_silently_merged(): void
    {
        $this->persister->persist('five', [$this->drawing()]);
        $drawing = Drawing::query()->firstOrFail();
        $duplicate = $drawing->replicate();
        $duplicate->source_key = 'legacy-key';
        $duplicate->save();
        $before = $this->snapshot();
        try {
            $this->persister->persist('five', [$this->drawing()]);
            $this->fail('Duplicate stored dates must fail.');
        } catch (RuntimeException) {
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_database_failure_restores_replaced_children_and_rolls_back_new_drawings(): void
    {
        $this->persister->persist('five', [$this->drawing()]);
        $before = $this->snapshot();
        DB::unprepared("CREATE TRIGGER fail_test_prize BEFORE INSERT ON drawing_prizes WHEN NEW.winner_count = 42 BEGIN SELECT RAISE(ABORT, 'controlled test failure'); END");
        try {
            $this->persister->persist('five', [
                $this->drawing(date: '2026-10-04'),
                $this->drawing(sets: [new NormalizedNumberSet('main', [6, 7, 8, 9, 10])],
                    prizes: [new NormalizedPrizeTier('match_5', 42, '100.00', 'HUF')]),
            ]);
            $this->fail('A database failure must roll back the entire batch.');
        } catch (QueryException) {
            $this->assertSame($before, $this->snapshot());
        } finally {
            DB::unprepared('DROP TRIGGER fail_test_prize');
        }
    }

    public function test_duplicate_numbers_cannot_partially_persist_a_batch(): void
    {
        try {
            $this->persister->persist('five', [$this->drawing(), $this->drawing(date: '2026-10-04',
                sets: [new NormalizedNumberSet('main', [1, 1, 2, 3, 4])])]);
            $this->fail('Database uniqueness must protect each set.');
        } catch (QueryException) {
            $this->assertDatabaseCount('drawings', 0);
            $this->assertDatabaseCount('drawing_sets', 0);
            $this->assertDatabaseCount('drawing_numbers', 0);
            $this->assertDatabaseCount('drawing_prizes', 0);
        }
    }

    public function test_import_states_are_untouched_by_success_or_failure(): void
    {
        $game = Game::query()->where('code', 'five')->firstOrFail();
        $state = $game->importState()->create([
            'status' => 'failed', 'error_message' => 'Synchronization unavailable.',
            'last_attempted_at' => '2026-10-01 00:00:00', 'last_succeeded_at' => '2026-09-30 00:00:00',
        ]);
        $before = $state->refresh()->getRawOriginal();
        $this->persister->persist('five', [$this->drawing()]);
        try {
            $this->persister->persist('five', [$this->drawing(date: '2026-10-04', sets: [new NormalizedNumberSet('main', [1, 1])])]);
            $this->fail('Invalid child rows must fail.');
        } catch (QueryException) {
            $this->assertSame($before, $state->refresh()->getRawOriginal());
        }
        $this->persister->persist('six', [$this->drawing(game: 'six', sets: [new NormalizedNumberSet('main', [1, 2, 3, 4, 5, 6])])]);
        $this->assertDatabaseCount('game_import_states', 1);
    }

    /**
     * @param  list<NormalizedNumberSet>|null  $sets
     * @param  list<NormalizedPrizeTier>|null  $prizes
     */
    private function drawing(string $game = 'five', ?string $date = '2026-10-03', ?array $sets = null, ?array $prizes = null): NormalizedDrawing
    {
        $sets ??= [new NormalizedNumberSet('main', [1, 2, 3, 4, 5])];
        $identity = implode('|', array_map(static fn (NormalizedNumberSet $set): string => $set->type.':'.implode(',', $set->numbers), $sets));

        return new NormalizedDrawing(
            $game, $date === null ? 'undated:2026-W40:'.hash('sha256', $identity) : 'date:'.$date,
            2026, 40, $date === null ? null : new DateTimeImmutable($date), $sets,
            $prizes ?? [new NormalizedPrizeTier('match_5', 1, '123456789012.00', 'HUF')],
        );
    }

    private function assertCounts(LotteryPersistenceResult $result, int $inserted, int $updated, int $unchanged): void
    {
        $this->assertSame($inserted, $result->inserted);
        $this->assertSame($updated, $result->updated);
        $this->assertSame($unchanged, $result->unchanged);
        $this->assertSame($inserted + $updated + $unchanged, $result->processed);
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function snapshot(): array
    {
        $snapshot = [];
        foreach (['games', 'drawings', 'drawing_sets', 'drawing_numbers', 'drawing_prizes', 'game_import_states'] as $table) {
            $snapshot[$table] = DB::table($table)->orderBy('id')->get()->map(static fn (object $row): array => (array) $row)->all();
        }

        return $snapshot;
    }
}
