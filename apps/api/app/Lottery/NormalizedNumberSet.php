<?php

namespace App\Lottery;

final readonly class NormalizedNumberSet
{
    /** @param list<int> $numbers */
    public function __construct(
        public string $type,
        public array $numbers,
    ) {}
}
