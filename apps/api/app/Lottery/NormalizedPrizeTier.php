<?php

namespace App\Lottery;

final readonly class NormalizedPrizeTier
{
    public function __construct(
        public string $tier,
        public ?int $winnerCount,
        public ?string $amount,
        public ?string $currency,
    ) {}
}
