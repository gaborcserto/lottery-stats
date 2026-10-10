<?php

namespace App\Lottery;

use DateTimeImmutable;

final readonly class NormalizedDrawing
{
    /**
     * @param  list<NormalizedNumberSet>  $numberSets
     * @param  list<NormalizedPrizeTier>  $prizes
     */
    public function __construct(
        public string $gameCode,
        public string $sourceKey,
        public int $year,
        public int $week,
        public ?DateTimeImmutable $drawnOn,
        public array $numberSets,
        public array $prizes,
    ) {}
}
