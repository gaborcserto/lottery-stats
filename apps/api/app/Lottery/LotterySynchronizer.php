<?php

namespace App\Lottery;

use App\Models\Game;
use App\Models\GameImportState;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

final class LotterySynchronizer
{
    public function __construct(
        private readonly LotterySourceClient $sourceClient,
        private readonly LotteryPayloadNormalizer $normalizer,
        private readonly LotteryDrawingPersister $persister,
    ) {}

    public function synchronize(string $gameCode, bool $force = false): LotterySynchronizationResult
    {
        $game = Game::query()->where('code', $gameCode)->first();
        if ($game === null || ! array_key_exists($gameCode, $this->sources())) {
            return LotterySynchronizationResult::failed($gameCode, 'Unsupported lottery game.');
        }

        try {
            $lockSeconds = $this->positiveConfigInteger('lock_seconds', 86_400);
            $this->positiveConfigInteger('interval_hours', 8_760);
        } catch (LotterySyncException $exception) {
            return LotterySynchronizationResult::failed($gameCode, $exception->getMessage());
        }

        try {
            $lock = Cache::lock('lottery-sync:'.$gameCode, $lockSeconds);
            if (! $lock->get()) {
                return LotterySynchronizationResult::locked($gameCode);
            }
        } catch (Throwable) {
            return LotterySynchronizationResult::failed($gameCode, 'The synchronization lock is unavailable.');
        }

        $state = null;
        try {
            $state = GameImportState::query()->firstOrCreate(['game_id' => $game->id]);
            if (! $force && ! $this->isDue($game, $state)) {
                return LotterySynchronizationResult::skipped($gameCode);
            }

            $attemptedAt = now();
            $state->update([
                'last_attempted_at' => $attemptedAt,
                'status' => 'running',
                'error_message' => null,
            ]);

            $payload = $this->sourceClient->retrieve($gameCode);
            $drawings = $this->normalizer->normalize($gameCode, $payload);

            $persistence = DB::transaction(function () use ($gameCode, $drawings, $state): LotteryPersistenceResult {
                $result = $this->persister->persist($gameCode, $drawings);
                $state->update([
                    'last_succeeded_at' => now(),
                    'status' => 'succeeded',
                    'error_message' => null,
                ]);

                return $result;
            });

            return LotterySynchronizationResult::synchronized($gameCode, $persistence);
        } catch (Throwable $exception) {
            $message = $this->safeFailureMessage($exception);
            $this->recordFailure($state, $message);

            return LotterySynchronizationResult::failed($gameCode, $message);
        } finally {
            $this->release($lock);
        }
    }

    /** @return array<string, mixed> */
    public function sources(): array
    {
        $sources = config('lottery.sources');

        return is_array($sources) ? $sources : [];
    }

    private function isDue(Game $game, GameImportState $state): bool
    {
        if (! $game->drawings()->exists() || $state->last_succeeded_at === null) {
            return true;
        }

        /** @var ?CarbonInterface $lastSucceededAt */
        $lastSucceededAt = $state->getAttribute('last_succeeded_at');

        return $lastSucceededAt === null
            || $lastSucceededAt->lte(now()->subHours($this->positiveConfigInteger('interval_hours', 8_760)));
    }

    private function positiveConfigInteger(string $key, int $maximum): int
    {
        $value = config("lottery.sync.{$key}");
        if (! is_int($value) && ! (is_string($value) && ctype_digit($value))) {
            throw new LotterySyncException("The lottery {$key} configuration is invalid.");
        }

        $value = (int) $value;
        if ($value < 1 || $value > $maximum) {
            throw new LotterySyncException("The lottery {$key} configuration is invalid.");
        }

        return $value;
    }

    private function safeFailureMessage(Throwable $exception): string
    {
        if ($exception instanceof LotterySyncException || $exception instanceof LotteryNormalizationException) {
            return mb_substr($exception->getMessage(), 0, 500);
        }

        return 'Lottery data persistence failed.';
    }

    private function recordFailure(?GameImportState $state, string $message): void
    {
        if ($state === null) {
            return;
        }

        try {
            $state->refresh()->update(['status' => 'failed', 'error_message' => $message]);
        } catch (Throwable) {
            // The synchronization result remains a failure if state storage is unavailable.
        }
    }

    private function release(Lock $lock): void
    {
        try {
            $lock->release();
        } catch (Throwable) {
            // The lock expires automatically; never replace the synchronization result.
        }
    }
}
