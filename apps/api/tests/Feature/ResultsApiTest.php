<?php

namespace Tests\Feature;

use App\Models\Drawing;
use App\Models\Game;
use Database\Seeders\GameSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ResultsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed(GameSeeder::class);
    }

    public function test_games_are_listed_and_unknown_game_is_a_json_404(): void
    {
        $this->getJson('/api/v1/games')->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.code', 'five')
            ->assertJsonPath('data.1.code', 'six')
            ->assertJsonPath('data.2.code', 'scandinavian');
        $this->getJson('/api/v1/games/six')->assertOk()->assertJsonPath('data.code', 'six');
        $this->getJson('/api/v1/games/unknown')->assertNotFound()->assertJsonStructure(['message']);
    }

    public function test_list_paginates_filters_and_orders_same_week_drawings_deterministically(): void
    {
        $game = Game::query()->where('code', 'five')->firstOrFail();

        $this->makeDrawing($game, 'older', 2025, 52, '2025-12-28');
        $this->makeDrawing($game, 'week-early', 2026, 10, '2026-03-01');
        $this->makeDrawing($game, 'week-late', 2026, 10, '2026-03-07');
        $this->makeDrawing($game, 'week-undated', 2026, 10, null);
        $this->makeDrawing($game, 'other-week-undated', 2026, 9, null);

        $this->getJson('/api/v1/games/five/drawings')->assertOk()
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('data.0.id', Drawing::query()->where('source_key', 'week-late')->value('id'))
            ->assertJsonPath('data.1.id', Drawing::query()->where('source_key', 'week-early')->value('id'))
            ->assertJsonPath('data.2.id', Drawing::query()->where('source_key', 'week-undated')->value('id'));
        $this->getJson('/api/v1/games/five/drawings?year=2026&week=10')->assertOk()->assertJsonCount(3, 'data');
        $this->getJson('/api/v1/games/five/drawings?from_date=2026-03-02&to_date=2026-03-10')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/games/five/drawings?per_page=100')->assertJsonPath('meta.per_page', 100);
        $this->getJson('/api/v1/games/five/drawings?per_page=101')->assertUnprocessable();
        $this->getJson('/api/v1/games/five/drawings?page=0')->assertUnprocessable();
        $this->getJson('/api/v1/games/five/drawings?page=1000001')
            ->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->getJson('/api/v1/games/five/drawings?page=1000000')->assertOk();
        $this->getJson('/api/v1/games/five/drawings?week=54')->assertUnprocessable();
        $this->getJson('/api/v1/games/five/drawings?unknown=value')->assertUnprocessable();
        $this->getJson('/api/v1/games/five/drawings?from_date=not-a-date')->assertUnprocessable();
        $this->getJson('/api/v1/games/five/drawings?from_date=2026-04-01&to_date=2026-03-01')->assertUnprocessable();
    }

    public function test_latest_returns_newest_source_week_and_empty_game_is_404(): void
    {
        $game = Game::query()->where('code', 'six')->firstOrFail();

        $older = $this->makeDrawing($game, 'later-id', 2025, 1, '2025-01-01');
        $newest = $this->makeDrawing($game, 'newest', 2026, 2, null);

        $this->getJson('/api/v1/games/six/drawings/latest')->assertOk()->assertJsonPath('data.id', $newest->id);
        $this->getJson('/api/v1/games/five/drawings/latest')->assertNotFound();
        $this->getJson('/api/v1/games/six/drawings/'.$older->id)->assertOk();
        $this->getJson('/api/v1/games/five/drawings/'.$older->id)->assertNotFound();
    }

    public function test_drawing_pages_are_database_paginated(): void
    {
        $game = Game::query()->where('code', 'five')->firstOrFail();
        for ($index = 1; $index <= 25; $index++) {
            $this->makeDrawing($game, 'page-'.$index, 2000, 1, null);
        }

        $firstPage = $this->getJson('/api/v1/games/five/drawings')->assertOk()
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.total', 25);
        $secondPage = $this->getJson('/api/v1/games/five/drawings?page=2')->assertOk()
            ->assertJsonCount(5, 'data');

        $firstIds = collect($firstPage->json('data'))->pluck('id');
        $secondIds = collect($secondPage->json('data'))->pluck('id');
        $this->assertCount(0, $firstIds->intersect($secondIds));
    }

    public function test_detail_keeps_sets_prizes_and_exact_nullable_money_fields(): void
    {
        $six = Game::query()->where('code', 'six')->firstOrFail();

        $drawing = $this->makeDrawing($six, 'six-detail', 2026, 1, '2026-01-03');
        $main = $drawing->sets()->create(['type' => 'main']);
        $main->numbers()->createMany(array_map(fn (int $number): array => ['number' => $number], range(1, 6)));
        $bonus = $drawing->sets()->create(['type' => 'bonus']);
        $bonus->numbers()->create(['number' => 7]);
        $drawing->prizes()->create(['tier' => 'match_5_plus_1', 'winner_count' => null, 'amount' => '999999999999.00', 'currency' => 'HUF']);
        $drawing->prizes()->create(['tier' => 'match_6', 'winner_count' => null, 'amount' => null, 'currency' => null]);

        $this->getJson('/api/v1/games/six/drawings/'.$drawing->id)->assertOk()
            ->assertJsonPath('data.drawn_on', '2026-01-03')
            ->assertJsonPath('data.sets.0.type', 'main')
            ->assertJsonPath('data.sets.0.numbers', [1, 2, 3, 4, 5, 6])
            ->assertJsonPath('data.sets.1.type', 'bonus')
            ->assertJsonPath('data.sets.1.numbers', [7])
            ->assertJsonPath('data.prizes.0.amount', '999999999999.00')
            ->assertJsonPath('data.prizes.0.winner_count', null)
            ->assertJsonPath('data.prizes.1.amount', null);

        $skandi = Game::query()->where('code', 'scandinavian')->firstOrFail();

        $undated = $this->makeDrawing($skandi, 'skandi-detail', 1988, 43, null);
        foreach (['machine' => [1, 2, 3, 4, 5, 6, 7], 'manual' => [7, 8, 9, 10, 11, 12, 13]] as $type => $numbers) {
            $set = $undated->sets()->create(['type' => $type]);
            $set->numbers()->createMany(array_map(fn (int $number): array => ['number' => $number], $numbers));
        }
        $this->getJson('/api/v1/games/scandinavian/drawings/'.$undated->id)->assertOk()
            ->assertJsonPath('data.drawn_on', null)
            ->assertJsonPath('data.sets.0.type', 'machine')
            ->assertJsonPath('data.sets.1.type', 'manual');
    }

    public function test_empty_collection_and_invalid_game_use_json_contracts(): void
    {
        $this->getJson('/api/v1/games/five/drawings')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/games/invalid/drawings')->assertNotFound()->assertJsonStructure(['message']);
        $this->getJson('/api/v1/games/five/drawings/999999')->assertNotFound()->assertJsonStructure(['message']);
        $this->getJson('/api/v1/games/five/drawings/9223372036854775808')
            ->assertNotFound()->assertJsonStructure(['message']);
    }

    public function test_history_details_are_filtered_paginated_and_eager_loaded(): void
    {
        $game = Game::query()->where('code', 'six')->firstOrFail();

        for ($week = 1; $week <= 6; $week++) {
            $drawing = $this->makeDrawing($game, 'history-'.$week, 2026, $week, null);
            $main = $drawing->sets()->create(['type' => 'main']);
            $main->numbers()->createMany(array_map(fn (int $number): array => ['number' => $number], range(1, 6)));
            $drawing->prizes()->create(['tier' => 'match_6', 'winner_count' => null, 'amount' => '999999999999.00', 'currency' => 'HUF']);
        }

        $this->getJson('/api/v1/games/six/drawings?include=invalid')->assertUnprocessable();
        $summary = $this->getJson('/api/v1/games/six/drawings?per_page=5')->assertOk();
        $this->assertArrayNotHasKey('sets', $summary->json('data.0'));
        DB::enableQueryLog();
        DB::flushQueryLog();
        $page = $this->getJson('/api/v1/games/six/drawings?include=details&per_page=5&year=2026')->assertOk()
            ->assertJsonCount(5, 'data')->assertJsonPath('meta.total', 6)
            ->assertJsonPath('data.0.week', 6)->assertJsonPath('data.0.drawn_on', null)
            ->assertJsonPath('data.0.sets.0.numbers', [1, 2, 3, 4, 5, 6])
            ->assertJsonPath('data.0.prizes.0.amount', '999999999999.00');
        // Game, count, page, sets, numbers and prizes: independent of page size.
        $this->assertCount(6, DB::getQueryLog());
        DB::disableQueryLog();
        $id = $page->json('data.0.id');
        $this->assertSame($this->getJson('/api/v1/games/six/drawings/'.$id)->json('data'), $page->json('data.0'));
        $this->getJson('/api/v1/games/six/drawings?include=details&per_page=5&page=2&year=2026')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.week', 1);
        $this->getJson('/api/v1/games/six/drawings?include=details&year=2025')->assertOk()->assertJsonCount(0, 'data');
    }

    private function makeDrawing(Game $game, string $key, int $year, int $week, ?string $date): Drawing
    {
        return $game->drawings()->create([
            'source_key' => $key,
            'year' => $year,
            'week' => $week,
            'drawn_on' => $date,
        ]);
    }
}
