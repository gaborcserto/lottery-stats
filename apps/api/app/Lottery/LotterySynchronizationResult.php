<?php

namespace App\Lottery;

final readonly class LotterySynchronizationResult
{
    private function __construct(
        public string $gameCode,
        public string $status,
        public ?LotteryPersistenceResult $persistence = null,
        public ?string $message = null,
    ) {}

    public static function synchronized(string $gameCode, LotteryPersistenceResult $persistence): self
    {
        return new self($gameCode, 'synchronized', $persistence);
    }

    public static function skipped(string $gameCode): self
    {
        return new self($gameCode, 'skipped');
    }

    public static function locked(string $gameCode): self
    {
        return new self($gameCode, 'locked', message: 'Synchronization is already running.');
    }

    public static function failed(string $gameCode, string $message): self
    {
        return new self($gameCode, 'failed', message: $message);
    }

    public function failedOrLocked(): bool
    {
        return in_array($this->status, ['failed', 'locked'], true);
    }
}
