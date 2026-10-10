<?php

namespace App\Console\Commands;

use App\Lottery\LotterySynchronizationResult;
use App\Lottery\LotterySynchronizer;
use App\Models\Game;
use App\Models\GameImportState;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

final class SyncLotteryCommand extends Command
{
    protected $signature = 'lottery:sync
        {game? : Stable game code (five, six, or scandinavian)}
        {--force : Ignore the freshness interval}
        {--status : Show synchronization state without fetching}
        {--startup : Run under the optional local startup policy}';

    protected $description = 'Synchronize normalized official lottery drawings';

    public function handle(LotterySynchronizer $synchronizer): int
    {
        if ($this->option('startup')) {
            $startupEnabled = $this->startupEnabled();
            if ($startupEnabled === null) {
                return self::FAILURE;
            }
            if (! $startupEnabled) {
                return self::SUCCESS;
            }
        }

        if ($this->option('startup') && ! $this->waitForSchema()) {
            $this->warn('Lottery synchronization skipped because the database schema is not ready.');

            return self::FAILURE;
        }

        $sources = $synchronizer->sources();
        $requested = $this->argument('game');
        if ($requested !== null && ! array_key_exists($requested, $sources)) {
            $this->error('Unsupported lottery game. Expected: '.implode(', ', array_keys($sources)).'.');

            return self::INVALID;
        }

        $gameCodes = is_string($requested) ? [$requested] : array_keys($sources);
        if ($this->option('status')) {
            $this->renderStatus($gameCodes);

            return self::SUCCESS;
        }

        $failed = false;

        foreach ($gameCodes as $gameCode) {
            $result = $synchronizer->synchronize($gameCode, (bool) $this->option('force'));
            $this->renderResult($result);
            $failed = $failed || $result->failedOrLocked();
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    private function startupEnabled(): ?bool
    {
        if (app()->environment('testing') || ! app()->environment('local')) {
            return false;
        }

        $enabled = config('lottery.sync.auto');
        if (! is_bool($enabled)) {
            $this->error('LOTTERY_AUTO_SYNC must be true or false.');

            return null;
        }

        return $enabled;
    }

    private function waitForSchema(): bool
    {
        $wait = config('lottery.sync.startup_schema_wait_seconds');
        if (! is_int($wait) && ! (is_string($wait) && ctype_digit($wait))) {
            return false;
        }

        $deadline = time() + min((int) $wait, 600);
        do {
            if ($this->schemaReady()) {
                return true;
            }

            if (time() >= $deadline) {
                return false;
            }

            sleep(2);
        } while (true);
    }

    private function schemaReady(): bool
    {
        foreach (['games', 'drawings', 'game_import_states', 'cache_locks'] as $table) {
            if (! Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    private function renderResult(LotterySynchronizationResult $result): void
    {
        if ($result->status === 'synchronized' && $result->persistence !== null) {
            $counts = $result->persistence;
            $this->info(sprintf(
                '%s: synchronized (%d inserted, %d updated, %d unchanged, %d processed)',
                $result->gameCode,
                $counts->inserted,
                $counts->updated,
                $counts->unchanged,
                $counts->processed,
            ));

            return;
        }

        if ($result->status === 'skipped') {
            $this->line($result->gameCode.': fresh; skipped');

            return;
        }

        $this->error($result->gameCode.': '.($result->message ?? 'Synchronization failed.'));
    }

    /** @param list<string> $gameCodes */
    private function renderStatus(array $gameCodes): void
    {
        $games = Game::query()->whereIn('code', $gameCodes)->get()->keyBy('code');

        foreach ($gameCodes as $gameCode) {
            $game = $games->get($gameCode);
            $state = $game instanceof Game
                ? GameImportState::query()->where('game_id', $game->id)->first()
                : null;
            $status = $state instanceof GameImportState ? $state->status : 'pending';
            /** @var ?CarbonInterface $attemptedAt */
            $attemptedAt = $state?->getAttribute('last_attempted_at');
            /** @var ?CarbonInterface $succeededAt */
            $succeededAt = $state?->getAttribute('last_succeeded_at');
            $this->line(sprintf(
                '%s: %s; last attempted %s; last succeeded %s',
                $gameCode,
                $status,
                $attemptedAt?->format('Y-m-d H:i:s') ?? 'never',
                $succeededAt?->format('Y-m-d H:i:s') ?? 'never',
            ));
        }
    }
}
