<?php

namespace App\Lottery;

use InvalidArgumentException;

final class LotteryNormalizationException extends InvalidArgumentException
{
    public function __construct(
        public readonly string $gameCode,
        public readonly ?int $recordIndex,
        public readonly string $field,
        public readonly string $reason,
    ) {
        $location = $recordIndex === null ? 'payload' : "drawings[{$recordIndex}]";

        parent::__construct("Lottery source [{$gameCode}], {$location}, field [{$field}]: {$reason}");
    }
}
