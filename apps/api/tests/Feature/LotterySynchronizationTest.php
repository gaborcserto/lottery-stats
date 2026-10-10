<?php

namespace Tests\Feature;

use App\Lottery\LotterySynchronizer;
use App\Models\Drawing;
use App\Models\Game;
use App\Models\GameImportState;
use Database\Seeders\GameSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LotterySynchronizationTest extends TestCase
{
    use RefreshDatabase;

    private LotterySynchronizer $synchronizer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed(GameSeeder::class);
        Http::preventStrayRequests();
        $this->synchronizer = app(LotterySynchronizer::class);
    }

    public function test_first_synchronization_persists_data_and_success_state(): void
    {
        $this->travelTo('2026-10-10 12:00:00');
        Http::fake([$this->url('five') => Http::response($this->payload('five'))]);

        $result = $this->synchronizer->synchronize('five');

        $this->assertSame('synchronized', $result->status);
        $this->assertSame(1, $result->persistence?->inserted);
        $this->assertDatabaseCount('drawings', 1);
        $state = $this->state('five');
        $this->assertSame('succeeded', $state->status);
        $this->assertSame('2026-10-10 12:00:00', $state->last_attempted_at?->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-10 12:00:00', $state->last_succeeded_at?->format('Y-m-d H:i:s'));
        $this->assertNull($state->error_message);
        Http::assertSentCount(1);
    }

    public function test_fresh_data_is_skipped_without_http_and_force_refreshes_it(): void
    {
        Http::fake([$this->url('five') => Http::response($this->payload('five'))]);
        $this->synchronizer->synchronize('five');
        $attemptedAt = $this->state('five')->getRawOriginal('last_attempted_at');
        $this->travel(1)->hour();

        $skipped = $this->synchronizer->synchronize('five');
        $forced = $this->synchronizer->synchronize('five', true);

        $this->assertSame('skipped', $skipped->status);
        $this->assertSame('synchronized', $forced->status);
        $this->assertSame(1, $forced->persistence?->unchanged);
        $this->assertNotSame($attemptedAt, $this->state('five')->getRawOriginal('last_attempted_at'));
        Http::assertSentCount(2);
    }

    public function test_stale_data_refreshes_at_the_configured_boundary(): void
    {
        config()->set('lottery.sync.interval_hours', 12);
        Http::fake([$this->url('five') => Http::response($this->payload('five'))]);
        $this->synchronizer->synchronize('five');
        $this->travel(12)->hours();

        $result = $this->synchronizer->synchronize('five');

        $this->assertSame('synchronized', $result->status);
        Http::assertSentCount(2);
    }

    public function test_freshness_is_independent_for_each_game(): void
    {
        Http::fake([
            $this->url('five') => Http::response($this->payload('five')),
            $this->url('six') => Http::response($this->payload('six')),
        ]);
        $this->synchronizer->synchronize('five');

        $this->assertSame('skipped', $this->synchronizer->synchronize('five')->status);
        $this->assertSame('synchronized', $this->synchronizer->synchronize('six')->status);
        $this->assertDatabaseCount('game_import_states', 2);
        $this->assertSame('succeeded', $this->state('five')->status);
        $this->assertSame('succeeded', $this->state('six')->status);
        Http::assertSentCount(2);
    }

    public function test_network_and_http_failures_do_not_advance_success_time(): void
    {
        Http::fake([$this->url('five') => Http::response($this->payload('five'))]);
        $this->synchronizer->synchronize('five');
        $succeededAt = $this->state('five')->getRawOriginal('last_succeeded_at');
        $this->travel(25)->hours();

        Http::fake([$this->url('five') => Http::failedConnection('timeout')]);
        $network = $this->synchronizer->synchronize('five');
        $this->assertSame('failed', $network->status);
        $this->assertSame($succeededAt, $this->state('five')->getRawOriginal('last_succeeded_at'));
        $this->assertSame('failed', $this->state('five')->status);
        Http::assertSentCount(3);

        Http::fake([$this->url('five') => Http::response([], 503)]);
        $http = $this->synchronizer->synchronize('five');
        $this->assertSame('failed', $http->status);
        $this->assertSame($succeededAt, $this->state('five')->getRawOriginal('last_succeeded_at'));
    }

    public function test_invalid_json_oversized_and_normalization_failures_are_recorded(): void
    {
        config()->set('lottery.sync.max_response_bytes', 20);
        foreach ([
            Http::response('{broken', 200, ['Content-Type' => 'application/json']),
            Http::response(str_repeat('x', 21), 200, ['Content-Type' => 'application/json']),
            Http::response(['drawings' => [['year' => 2026, 'week' => 40, 'date' => '2026.10.03.', 'numbers' => [1, 1, 2, 3, 4]]]]),
        ] as $response) {
            Http::fake([$this->url('five') => $response]);
            $result = $this->synchronizer->synchronize('five', true);
            $this->assertSame('failed', $result->status);
            $this->assertSame('failed', $this->state('five')->status);
            $this->assertNull($this->state('five')->last_succeeded_at);
            $this->assertDatabaseCount('drawings', 0);
        }
    }

    public function test_persistence_failure_rolls_back_and_preserves_existing_drawings(): void
    {
        Http::fakeSequence($this->url('five'))
            ->push($this->payload('five'))
            ->push($this->payload('five', winnerCount: 42));
        $this->synchronizer->synchronize('five');
        $before = Drawing::query()->with(['sets.numbers', 'prizes'])->get()->toArray();
        $succeededAt = $this->state('five')->getRawOriginal('last_succeeded_at');
        DB::unprepared("CREATE TRIGGER fail_sync_prize BEFORE INSERT ON drawing_prizes WHEN NEW.winner_count = 42 BEGIN SELECT RAISE(ABORT, 'controlled test failure'); END");

        try {
            $result = $this->synchronizer->synchronize('five', true);
            $this->assertSame('failed', $result->status);
            $this->assertSame('Lottery data persistence failed.', $result->message);
            $this->assertSame($before, Drawing::query()->with(['sets.numbers', 'prizes'])->get()->toArray());
            $this->assertSame($succeededAt, $this->state('five')->getRawOriginal('last_succeeded_at'));
            $this->assertSame('failed', $this->state('five')->status);
        } finally {
            DB::unprepared('DROP TRIGGER fail_sync_prize');
        }
    }

    public function test_an_existing_game_lock_prevents_concurrent_http_and_is_released_after_failure(): void
    {
        $lock = Cache::lock('lottery-sync:five', 60);
        $this->assertTrue($lock->get());
        Http::fakeSequence($this->url('five'))
            ->push('{broken', 200, ['Content-Type' => 'application/json'])
            ->push($this->payload('five'));

        $locked = $this->synchronizer->synchronize('five');
        $this->assertSame('locked', $locked->status);
        Http::assertNothingSent();
        $lock->release();

        $this->assertSame('failed', $this->synchronizer->synchronize('five')->status);
        $this->assertSame('synchronized', $this->synchronizer->synchronize('five')->status);
    }

    public function test_untrusted_source_configuration_is_rejected_without_a_request(): void
    {
        config()->set('lottery.sources.five', 'https://example.test/otos.json');
        Http::fake();

        $result = $this->synchronizer->synchronize('five');

        $this->assertSame('failed', $result->status);
        $this->assertSame('The configured lottery source is not allowed.', $result->message);
        Http::assertNothingSent();
    }

    public function test_invalid_freshness_configuration_is_rejected_without_a_request(): void
    {
        config()->set('lottery.sync.interval_hours', 0);
        Http::fake();

        $result = $this->synchronizer->synchronize('five');

        $this->assertSame('failed', $result->status);
        $this->assertSame('The lottery interval_hours configuration is invalid.', $result->message);
        Http::assertNothingSent();
    }

    public function test_one_game_and_all_game_commands_report_results(): void
    {
        Http::fake([
            $this->url('five') => Http::response($this->payload('five')),
            $this->url('six') => Http::response($this->payload('six')),
            $this->url('scandinavian') => Http::response($this->payload('scandinavian')),
        ]);

        $this->artisan('lottery:sync', ['game' => 'five'])
            ->expectsOutputToContain('five: synchronized')
            ->assertSuccessful();
        $this->artisan('lottery:sync', ['--force' => true])
            ->expectsOutputToContain('five: synchronized')
            ->expectsOutputToContain('six: synchronized')
            ->expectsOutputToContain('scandinavian: synchronized')
            ->assertSuccessful();
        Http::assertSentCount(4);
    }

    public function test_status_command_reports_state_without_http(): void
    {
        Http::fake();

        $this->artisan('lottery:sync', ['--status' => true])
            ->expectsOutputToContain('five: pending; last attempted never; last succeeded never')
            ->expectsOutputToContain('six: pending; last attempted never; last succeeded never')
            ->assertSuccessful();

        Http::assertNothingSent();
    }

    public function test_command_rejects_an_unsupported_game_and_returns_failure_for_sync_errors(): void
    {
        $this->artisan('lottery:sync', ['game' => 'unknown'])->assertExitCode(2);

        Http::fake([$this->url('five') => Http::response([], 500)]);
        $this->artisan('lottery:sync', ['game' => 'five'])
            ->expectsOutputToContain('five: The lottery source returned HTTP 500.')
            ->assertFailed();
    }

    public function test_startup_never_synchronizes_in_phpunit_even_when_enabled(): void
    {
        config()->set('lottery.sync.auto', true);
        Http::fake();

        $this->artisan('lottery:sync', ['--startup' => true])->assertSuccessful();

        Http::assertNothingSent();
        $this->assertDatabaseCount('game_import_states', 0);
    }

    public function test_startup_is_disabled_outside_local_development(): void
    {
        config()->set('lottery.sync.auto', true);
        $this->app->detectEnvironment(static fn (): string => 'production');
        Http::fake();

        $this->artisan('lottery:sync', ['--startup' => true])->assertSuccessful();

        Http::assertNothingSent();
        $this->assertDatabaseCount('game_import_states', 0);
    }

    private function state(string $gameCode): GameImportState
    {
        $game = Game::query()->where('code', $gameCode)->firstOrFail();

        return GameImportState::query()->where('game_id', $game->id)->firstOrFail();
    }

    private function url(string $gameCode): string
    {
        $url = config("lottery.sources.{$gameCode}");
        $this->assertIsString($url);

        return $url;
    }

    /** @return array{drawings: list<array<string, mixed>>} */
    private function payload(string $gameCode, int $winnerCount = 1): array
    {
        $numbers = match ($gameCode) {
            'five' => [1, 2, 3, 4, 5],
            'six' => [1, 2, 3, 4, 5, 6],
            'scandinavian' => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        };
        $record = [
            'year' => 2026,
            'week' => 40,
            'date' => '2026.10.03.',
            'numbers' => $numbers,
        ];
        if ($gameCode === 'five') {
            $record['5HitCount'] = $winnerCount;
            $record['5HitPrize'] = '100 Ft';
        }

        return ['drawings' => [$record]];
    }
}
