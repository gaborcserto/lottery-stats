<?php

namespace Tests\Feature;

use App\Models\Drawing;
use App\Models\DrawingPrize;
use App\Models\Game;
use App\Models\GameImportState;
use Database\Seeders\GameSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LotterySchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_lottery_tables_migrate_and_games_can_be_seeded_idempotently(): void
    {
        foreach ([
            'games',
            'drawings',
            'drawing_sets',
            'drawing_numbers',
            'drawing_prizes',
            'game_import_states',
        ] as $table) {
            $this->assertTrue($this->app['db']->getSchemaBuilder()->hasTable($table));
        }

        $this->seed(GameSeeder::class);
        $this->seed(GameSeeder::class);

        $this->assertDatabaseCount('games', 3);
        $this->assertDatabaseHas('games', ['code' => 'five', 'name' => 'Ötöslottó']);
        $this->assertDatabaseHas('games', ['code' => 'six', 'name' => 'Hatoslottó']);
        $this->assertDatabaseHas('games', ['code' => 'scandinavian', 'name' => 'Skandináv lottó']);
    }

    public function test_models_expose_expected_relationships_and_allow_multiple_weekly_drawings(): void
    {
        $game = Game::query()->create(['code' => 'six', 'name' => 'Hatoslottó']);
        $first = $game->drawings()->create([
            'source_key' => '2026-40-2026-10-01',
            'year' => '2026',
            'week' => '40',
            'drawn_on' => '2026-10-01',
        ]);
        $second = $game->drawings()->create([
            'source_key' => '2026-40-2026-10-04',
            'year' => 2026,
            'week' => 40,
            'drawn_on' => '2026-10-04',
        ]);

        $this->assertCount(2, $game->drawings);
        $this->assertSame($game->id, $first->game->id);
        $this->assertSame(2026, $first->year);
        $this->assertSame(40, $first->week);
        $this->assertSame('2026-10-01', $first->drawn_on->toDateString());
        $this->assertSame($first->id, $first->refresh()->id);
        $this->assertNotSame($first->id, $second->id);
    }

    public function test_dates_can_be_missing_and_scandinavian_sets_can_coexist(): void
    {
        $game = Game::query()->create(['code' => 'scandinavian', 'name' => 'Skandináv lottó']);
        $drawing = $game->drawings()->create([
            'source_key' => 'historic-1988-43',
            'year' => 1988,
            'week' => 43,
            'drawn_on' => null,
        ]);

        $machineSet = $drawing->sets()->create(['type' => 'machine']);
        $manualSet = $drawing->sets()->create(['type' => 'manual']);
        $machineNumber = $machineSet->numbers()->create(['number' => 1]);

        $this->assertNull($drawing->drawn_on);
        $this->assertCount(2, $drawing->sets);
        $this->assertSame($drawing->id, $machineSet->drawing->id);
        $this->assertSame($machineSet->id, $machineNumber->drawingSet->id);
        $this->assertSame(1, $machineNumber->number);
    }

    public function test_database_rejects_invalid_foreign_keys_and_duplicate_set_types(): void
    {
        try {
            Drawing::query()->create([
                'game_id' => 999,
                'source_key' => 'missing-game',
                'year' => 2026,
                'week' => 1,
            ]);
            $this->fail('Drawings must reference an existing game.');
        } catch (QueryException) {
            $this->assertDatabaseCount('drawings', 0);
        }

        $drawing = $this->createDrawing();
        $drawing->sets()->create(['type' => 'main']);

        $this->expectException(QueryException::class);
        $drawing->sets()->create(['type' => 'main']);
    }

    public function test_database_rejects_duplicate_numbers(): void
    {
        $drawing = $this->createDrawing();
        $set = $drawing->sets()->create(['type' => 'main']);
        $set->numbers()->create(['number' => 5]);

        try {
            $set->numbers()->create(['number' => 5]);
            $this->fail('Duplicate numbers in one set must be rejected.');
        } catch (QueryException) {
            $this->assertDatabaseCount('drawing_numbers', 1);
        }

        try {
            $set->numbers()->create(['number' => 0]);
            $this->fail('Lottery numbers must be positive.');
        } catch (QueryException) {
            $this->assertDatabaseCount('drawing_numbers', 1);
        }

    }

    public function test_database_rejects_duplicate_identity_set_type_prize_tier_and_import_state(): void
    {
        $drawing = $this->createDrawing();
        $drawing->sets()->create(['type' => 'main']);

        try {
            $drawing->sets()->create(['type' => 'main']);
            $this->fail('A drawing cannot have duplicate set types.');
        } catch (QueryException) {
            $this->assertDatabaseCount('drawing_sets', 1);
        }

        $drawing->prizes()->create(['tier' => 'six', 'winner_count' => null, 'amount' => null]);
        $prize = DrawingPrize::query()->firstOrFail();
        $this->assertNull($prize->winner_count);
        $this->assertNull($prize->amount);
        $this->assertSame($drawing->id, $prize->drawing->id);

        try {
            $drawing->prizes()->create(['tier' => 'six']);
            $this->fail('A drawing cannot have duplicate prize tiers.');
        } catch (QueryException) {
            $this->assertDatabaseCount('drawing_prizes', 1);
        }

        $game = $drawing->game;
        $game->importState()->create(['status' => 'pending']);

        $this->expectException(QueryException::class);
        GameImportState::query()->create(['game_id' => $game->id, 'status' => 'pending']);
    }

    public function test_database_rejects_duplicate_drawing_identity(): void
    {
        $drawing = $this->createDrawing();

        $this->expectException(QueryException::class);
        Drawing::query()->create([
            'game_id' => $drawing->game_id,
            'source_key' => $drawing->source_key,
            'year' => $drawing->year,
            'week' => $drawing->week,
        ]);
    }

    private function createDrawing(): Drawing
    {
        $game = Game::query()->create(['code' => 'five', 'name' => 'Ötöslottó']);

        return $game->drawings()->create([
            'source_key' => '2026-40-2026-10-03',
            'year' => 2026,
            'week' => 40,
            'drawn_on' => '2026-10-03',
        ]);
    }
}
