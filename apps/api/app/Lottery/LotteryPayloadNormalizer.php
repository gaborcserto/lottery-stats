<?php

namespace App\Lottery;

use DateTimeImmutable;

final class LotteryPayloadNormalizer
{
    private const PRIZE_TIERS = [
        'five' => [
            '2' => 'match_2',
            '3' => 'match_3',
            '4' => 'match_4',
            '5' => 'match_5',
        ],
        'six' => [
            '3' => 'match_3',
            '4' => 'match_4',
            '5' => 'match_5',
            '5P1' => 'match_5_plus_1',
            '6' => 'match_6',
        ],
        'scandinavian' => [
            '4' => 'match_4',
            '5' => 'match_5',
            '6' => 'match_6',
            '7' => 'match_7',
        ],
    ];

    /**
     * Normalize one already-decoded official source payload.
     *
     * Exact duplicate drawings are returned once. Any malformed record or
     * conflicting records with one source key reject the entire payload.
     *
     * @param  array<string, mixed>  $payload
     * @return list<NormalizedDrawing>
     *
     * @throws LotteryNormalizationException
     */
    public function normalize(string $gameCode, array $payload): array
    {
        if (! isset(self::PRIZE_TIERS[$gameCode])) {
            $this->fail($gameCode, null, 'game_code', 'is not supported');
        }

        $records = $payload['drawings'] ?? null;

        if (! is_array($records) || ! array_is_list($records) || $records === []) {
            $this->fail($gameCode, null, 'drawings', 'must be a non-empty list of records');
        }

        $drawingsByKey = [];

        foreach ($records as $index => $record) {
            if (! is_array($record) || array_is_list($record)) {
                $this->fail($gameCode, $index, 'record', 'must be an object');
            }

            $drawing = $this->normalizeRecord($gameCode, $index, $record);
            $existing = $drawingsByKey[$drawing->sourceKey] ?? null;

            if ($existing instanceof NormalizedDrawing) {
                if ($this->sameDrawing($existing, $drawing)) {
                    continue;
                }

                $this->fail($gameCode, $index, 'source_key', 'conflicts with another record in this payload');
            }

            $drawingsByKey[$drawing->sourceKey] = $drawing;
        }

        $drawings = array_values($drawingsByKey);
        usort($drawings, static fn (NormalizedDrawing $left, NormalizedDrawing $right): int => [$left->year, $left->week, $left->sourceKey] <=> [$right->year, $right->week, $right->sourceKey]
        );

        return $drawings;
    }

    /** @param array<string, mixed> $record */
    private function normalizeRecord(string $gameCode, int $index, array $record): NormalizedDrawing
    {
        $prizeTiers = self::PRIZE_TIERS[$gameCode];
        $allowedFields = ['year', 'week', 'date', 'numbers'];

        foreach (array_keys($prizeTiers) as $tier) {
            $allowedFields[] = "{$tier}HitCount";
            $allowedFields[] = "{$tier}HitPrize";
        }

        foreach (array_keys($record) as $field) {
            if (! in_array($field, $allowedFields, true)) {
                $this->fail($gameCode, $index, (string) $field, 'is not a supported source field');
            }
        }

        foreach (['year', 'week', 'numbers'] as $field) {
            if (! array_key_exists($field, $record)) {
                $this->fail($gameCode, $index, $field, 'is required');
            }
        }

        $year = $this->parseInteger($record['year'], $gameCode, $index, 'year', 9999);
        $week = $this->parseInteger($record['week'], $gameCode, $index, 'week', 53);

        if ($year < 1) {
            $this->fail($gameCode, $index, 'year', 'must be a positive year');
        }

        if ($week < 1) {
            $this->fail($gameCode, $index, 'week', 'must be between 1 and 53');
        }

        $drawnOn = $this->parseDate($record['date'] ?? null, $gameCode, $index);
        $numberSets = $this->normalizeNumberSets($gameCode, $index, $record['numbers']);
        $prizes = $this->normalizePrizes($gameCode, $index, $record, $numberSets);
        $sourceKey = $this->sourceKey($year, $week, $drawnOn, $numberSets);

        return new NormalizedDrawing(
            gameCode: $gameCode,
            sourceKey: $sourceKey,
            year: $year,
            week: $week,
            drawnOn: $drawnOn,
            numberSets: $numberSets,
            prizes: $prizes,
        );
    }

    /** @return list<NormalizedNumberSet> */
    private function normalizeNumberSets(string $gameCode, int $index, mixed $numbers): array
    {
        if (! is_array($numbers) || ! array_is_list($numbers)) {
            $this->fail($gameCode, $index, 'numbers', 'must be a list');
        }

        if ($gameCode === 'five') {
            if (count($numbers) !== 5) {
                $this->fail($gameCode, $index, 'numbers', 'must contain exactly five main numbers');
            }

            return [$this->numberSet('main', $numbers, 1, 90, $gameCode, $index, 'numbers')];
        }

        if ($gameCode === 'six') {
            if (! in_array(count($numbers), [6, 7], true)) {
                $this->fail($gameCode, $index, 'numbers', 'must contain six main numbers and an optional bonus slot');
            }

            $sets = [$this->numberSet('main', array_slice($numbers, 0, 6), 1, 45, $gameCode, $index, 'numbers')];
            $bonus = count($numbers) === 7 ? $numbers[6] : null;

            if ($this->isMissingBonus($bonus)) {
                return $sets;
            }

            $bonusNumber = $this->parseLotteryNumber($bonus, 1, 45, $gameCode, $index, 'numbers[6]');

            if (in_array($bonusNumber, $sets[0]->numbers, true)) {
                $this->fail($gameCode, $index, 'numbers[6]', 'bonus number must differ from the six main numbers');
            }

            $sets[] = new NormalizedNumberSet('bonus', [$bonusNumber]);

            return $sets;
        }

        if (count($numbers) !== 14) {
            $this->fail($gameCode, $index, 'numbers', 'must contain fourteen values, seven for each set');
        }

        return [
            $this->numberSet('machine', array_slice($numbers, 0, 7), 1, 35, $gameCode, $index, 'numbers[0..6]'),
            $this->numberSet('manual', array_slice($numbers, 7, 7), 1, 35, $gameCode, $index, 'numbers[7..13]'),
        ];
    }

    /** @param list<mixed> $values */
    private function numberSet(
        string $type,
        array $values,
        int $minimum,
        int $maximum,
        string $gameCode,
        int $index,
        string $field,
    ): NormalizedNumberSet {
        $numbers = [];

        foreach ($values as $position => $value) {
            $numbers[] = $this->parseLotteryNumber($value, $minimum, $maximum, $gameCode, $index, "{$field}[{$position}]");
        }

        if (count(array_unique($numbers)) !== count($numbers)) {
            $this->fail($gameCode, $index, $field, "{$type} set contains duplicate numbers");
        }

        sort($numbers, SORT_NUMERIC);

        return new NormalizedNumberSet($type, $numbers);
    }

    /**
     * @param  array<string, mixed>  $record
     * @param  list<NormalizedNumberSet>  $numberSets
     * @return list<NormalizedPrizeTier>
     */
    private function normalizePrizes(string $gameCode, int $index, array $record, array $numberSets): array
    {
        $parsed = [];
        $complete = true;
        $allZero = true;
        $hasBonus = count($numberSets) === 2 && $numberSets[1]->type === 'bonus';

        foreach (self::PRIZE_TIERS[$gameCode] as $sourceTier => $tier) {
            $countField = "{$sourceTier}HitCount";
            $prizeField = "{$sourceTier}HitPrize";
            $hasCount = array_key_exists($countField, $record);
            $hasPrize = array_key_exists($prizeField, $record);

            if (! $hasCount && ! $hasPrize) {
                $complete = false;

                continue;
            }

            $winnerCount = $hasCount
                ? $this->parseNullableInteger($record[$countField], $gameCode, $index, $countField, 4_294_967_295)
                : null;
            [$amount, $currency] = $hasPrize
                ? $this->parseNullableAmount($record[$prizeField], $gameCode, $index, $prizeField)
                : [null, null];

            if (! $hasCount || ! $hasPrize || $winnerCount === null || $amount === null) {
                $complete = false;
            }

            if ($winnerCount !== 0 || $amount !== '0.00') {
                $allZero = false;
            }

            $parsed[$sourceTier] = [$tier, $winnerCount, $amount, $currency];
        }

        $prizes = [];
        $historicalZeroPlaceholder = $complete && $allZero && in_array($gameCode, ['five', 'six'], true);

        foreach ($parsed as [$sourceTier, $winnerCount, $amount, $currency]) {
            if ($sourceTier === 'match_5_plus_1' && $gameCode === 'six' && ! $hasBonus) {
                if (($winnerCount !== null && $winnerCount !== 0) || ($amount !== null && $amount !== '0.00')) {
                    $this->fail($gameCode, $index, '5P1HitPrize', 'has a payout but this record has no bonus number');
                }

                continue;
            }

            $prizes[] = new NormalizedPrizeTier(
                tier: $sourceTier,
                winnerCount: $historicalZeroPlaceholder ? null : $winnerCount,
                amount: $historicalZeroPlaceholder ? null : $amount,
                currency: $historicalZeroPlaceholder ? null : $currency,
            );
        }

        return $prizes;
    }

    /** @param list<NormalizedNumberSet> $numberSets */
    private function sourceKey(int $year, int $week, ?DateTimeImmutable $drawnOn, array $numberSets): string
    {
        if ($drawnOn !== null) {
            return 'date:'.$drawnOn->format('Y-m-d');
        }

        $identity = implode('|', array_map(
            static fn (NormalizedNumberSet $set): string => $set->type.':'.implode(',', $set->numbers),
            $numberSets,
        ));

        return sprintf('undated:%04d-W%02d:%s', $year, $week, hash('sha256', $identity));
    }

    private function parseDate(mixed $value, string $gameCode, int $index): ?DateTimeImmutable
    {
        if ($value === null) {
            return null;
        }

        if (! is_string($value)) {
            $this->fail($gameCode, $index, 'date', 'must be a date string or empty');
        }

        $value = $this->trimSourceWhitespace($value);

        if ($value === '') {
            return null;
        }

        $date = DateTimeImmutable::createFromFormat('!Y.m.d.', $value);
        $errors = DateTimeImmutable::getLastErrors();

        if ($date === false
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $date->format('Y.m.d.') !== $value) {
            $this->fail($gameCode, $index, 'date', 'must use a real YYYY.MM.DD. date or be empty');
        }

        return $date;
    }

    private function parseLotteryNumber(mixed $value, int $minimum, int $maximum, string $gameCode, int $index, string $field): int
    {
        if (is_int($value)) {
            $number = $value;
        } elseif (is_string($value)) {
            $text = $this->trimSourceWhitespace($value);

            if ($text === '' || ! preg_match('/\A\d+\z/D', $text)) {
                $this->fail($gameCode, $index, $field, 'must be a positive integer');
            }

            $number = $this->integerFromDigits($text, $gameCode, $index, $field, $maximum);
        } else {
            $this->fail($gameCode, $index, $field, 'must be a positive integer');
        }

        if ($number < $minimum || $number > $maximum) {
            $this->fail($gameCode, $index, $field, "must be between {$minimum} and {$maximum}");
        }

        return $number;
    }

    private function parseInteger(mixed $value, string $gameCode, int $index, string $field, int $maximum): int
    {
        if (is_int($value)) {
            $number = $value;
        } elseif (is_string($value)) {
            $text = $this->trimSourceWhitespace($value);

            if ($text === '' || ! preg_match('/\A\d+\z/D', $text)) {
                $this->fail($gameCode, $index, $field, 'must be an integer');
            }

            $number = $this->integerFromDigits($text, $gameCode, $index, $field, $maximum);
        } else {
            $this->fail($gameCode, $index, $field, 'must be an integer');
        }

        if ($number > $maximum) {
            $this->fail($gameCode, $index, $field, "must not exceed {$maximum}");
        }

        return $number;
    }

    private function parseNullableInteger(mixed $value, string $gameCode, int $index, string $field, int $maximum): ?int
    {
        if ($value === null || (is_string($value) && $this->trimSourceWhitespace($value) === '')) {
            return null;
        }

        if (is_string($value)) {
            $text = $this->normalizeGroupingWhitespace($this->trimSourceWhitespace($value));

            if (! preg_match('/\A(?:\d+|\d{1,3}(?: \d{3})+)\z/D', $text)) {
                $this->fail($gameCode, $index, $field, 'must be a nonnegative whole-number count');
            }

            $value = str_replace(' ', '', $text);
        }

        $count = $this->parseInteger($value, $gameCode, $index, $field, $maximum);

        if ($count < 0) {
            $this->fail($gameCode, $index, $field, 'must not be negative');
        }

        return $count;
    }

    /** @return array{?string, ?string} */
    private function parseNullableAmount(mixed $value, string $gameCode, int $index, string $field): array
    {
        if ($value === null || (is_string($value) && $this->trimSourceWhitespace($value) === '')) {
            return [null, null];
        }

        if (is_int($value)) {
            $digits = (string) $value;
        } elseif (is_string($value)) {
            $text = $this->normalizeGroupingWhitespace($this->trimSourceWhitespace($value));
            $text = preg_replace('/\s*Ft\z/u', '', $text) ?? '';

            if (! preg_match('/\A(?:\d+|\d{1,3}(?: \d{3})+)\z/D', $text)) {
                $this->fail($gameCode, $index, $field, 'must be a nonnegative HUF whole amount');
            }

            $digits = str_replace(' ', '', $text);
        } else {
            $this->fail($gameCode, $index, $field, 'must be a nonnegative HUF whole amount');
        }

        if (! ctype_digit($digits)) {
            $this->fail($gameCode, $index, $field, 'must be a nonnegative HUF whole amount');
        }

        $digits = ltrim($digits, '0') ?: '0';

        if (strlen($digits) > 12) {
            $this->fail($gameCode, $index, $field, 'exceeds the drawing_prizes amount precision');
        }

        return [$digits.'.00', 'HUF'];
    }

    private function integerFromDigits(string $digits, string $gameCode, int $index, string $field, int $maximum): int
    {
        $digits = ltrim($digits, '0') ?: '0';

        if (strlen($digits) > strlen((string) $maximum)) {
            $this->fail($gameCode, $index, $field, "must not exceed {$maximum}");
        }

        $value = (int) $digits;

        if ($value > $maximum) {
            $this->fail($gameCode, $index, $field, "must not exceed {$maximum}");
        }

        return $value;
    }

    private function isMissingBonus(mixed $value): bool
    {
        return $value === null || (is_string($value) && $this->trimSourceWhitespace($value) === '');
    }

    private function normalizeGroupingWhitespace(string $value): string
    {
        return preg_replace('/[\x{00A0}\x{202F}]/u', ' ', $value) ?? $value;
    }

    private function trimSourceWhitespace(string $value): string
    {
        return trim($value, " \t\n\r\0\x0B\xC2\xA0\xE2\x80\xAF");
    }

    private function sameDrawing(NormalizedDrawing $left, NormalizedDrawing $right): bool
    {
        return $left->gameCode === $right->gameCode
            && $left->year === $right->year
            && $left->week === $right->week
            && $left->drawnOn == $right->drawnOn
            && $left->numberSets == $right->numberSets
            && $left->prizes == $right->prizes;
    }

    private function fail(string $gameCode, ?int $index, string $field, string $reason): never
    {
        throw new LotteryNormalizationException($gameCode, $index, $field, $reason);
    }
}
