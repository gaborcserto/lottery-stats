<?php

namespace App\Lottery;

final readonly class LotteryPersistenceResult
{
    public int $processed;

    public function __construct(
        public int $inserted,
        public int $updated,
        public int $unchanged,
    ) {
        $this->processed = $inserted + $updated + $unchanged;
    }
}
