<?php

namespace Tests\Unit;

use App\Lottery\LotteryNormalizationException;
use App\Lottery\LotteryPayloadNormalizer;
use PHPUnit\Framework\TestCase;

class LotteryPayloadNormalizerTest extends TestCase
{
    private LotteryPayloadNormalizer $normalizer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->normalizer = new LotteryPayloadNormalizer;
    }

    public function test_five_normalizes_current_historical_missing_date_and_zero_prize_records(): void
    {
        $current = $this->fiveRecord(
            year: 2026,
            week: 40,
            date: '2026.10.03.',
            numbers: ['9', '48', '51', '83', '88'],
            winningPrize: true,
        );
        $historical = $this->fiveRecord(
            year: 1957,
            week: 10,
            date: '',
            numbers: ['16', '61', '71', '77', '89'],
        );

        $drawings = $this->normalizer->normalize('five', ['drawings' => [$current, $historical]]);

        $this->assertCount(2, $drawings);
        $this->assertSame(1957, $drawings[0]->year);
        $this->assertNull($drawings[0]->drawnOn);
        $this->assertSame('main', $drawings[0]->numberSets[0]->type);
        $this->assertSame([16, 61, 71, 77, 89], $drawings[0]->numberSets[0]->numbers);
        $this->assertStringStartsWith('undated:1957-W10:', $drawings[0]->sourceKey);
        $this->assertNull($drawings[0]->prizes[0]->winnerCount);
        $this->assertNull($drawings[0]->prizes[0]->amount);

        $this->assertSame('2026-10-03', $drawings[1]->drawnOn->format('Y-m-d'));
        $this->assertSame('date:2026-10-03', $drawings[1]->sourceKey);
        $this->assertSame('4213545.00', $drawings[1]->prizes[2]->amount);
        $this->assertSame('HUF', $drawings[1]->prizes[2]->currency);
    }

    public function test_five_trims_number_whitespace_and_preserves_source_week_year_at_new_year(): void
    {
        $record = $this->fiveRecord(
            year: 2025,
            week: 52,
            date: '2026.01.01.',
            numbers: ['1 ', '14 ', '51 ', '60 ', '64 '],
            winningPrize: true,
        );

        $drawing = $this->normalizer->normalize('five', ['drawings' => [$record]])[0];

        $this->assertSame(2025, $drawing->year);
        $this->assertSame(52, $drawing->week);
        $this->assertSame('2026-01-01', $drawing->drawnOn->format('Y-m-d'));
        $this->assertSame([1, 14, 51, 60, 64], $drawing->numberSets[0]->numbers);
    }

    public function test_six_separates_historical_bonus_and_omits_bonus_when_the_source_has_none(): void
    {
        $historical = $this->sixRecord(
            year: 1988,
            week: 43,
            date: '',
            numbers: ['3', '16', '24', '26', '36', '40', '27'],
        );
        foreach (['3', '4', '5', '5P1', '6'] as $tier) {
            $historical["{$tier}HitCount"] = '0';
            $historical["{$tier}HitPrize"] = '0 Ft';
        }
        $current = $this->sixRecord(
            year: 2026,
            week: 40,
            date: '2026.10.04.',
            numbers: ['11', '13', '18', '19', '23', '34'],
        );
        $current = array_replace($current, [
            '3HitCount' => '23548', '3HitPrize' => '3 075 Ft',
            '4HitCount' => '1372', '4HitPrize' => '11 410 Ft',
            '5HitCount' => '15', '5HitPrize' => '1 043 550 Ft',
            '5P1HitCount' => 0, '5P1HitPrize' => 0,
            '6HitCount' => '0', '6HitPrize' => '0 Ft',
        ]);
        $emptyBonus = $this->sixRecord(
            year: 2016,
            week: 47,
            date: '2016.11.27.',
            numbers: ['4', '21', '26', '31', '33', '37', ''],
        );
        $emptyBonus = array_replace($emptyBonus, [
            '3HitCount' => '40540', '3HitPrize' => '1 435 Ft',
            '4HitCount' => '2366', '4HitPrize' => '6 315 Ft',
            '5HitCount' => '46', '5HitPrize' => '324 850 Ft',
            '5P1HitCount' => '0', '5P1HitPrize' => '0 Ft',
            '6HitCount' => '0', '6HitPrize' => '0 Ft',
        ]);

        $drawings = $this->normalizer->normalize('six', ['drawings' => [$historical, $current, $emptyBonus]]);

        $this->assertCount(3, $drawings);
        $historicalDrawing = $drawings[0];
        $this->assertCount(2, $historicalDrawing->numberSets);
        $this->assertSame('main', $historicalDrawing->numberSets[0]->type);
        $this->assertSame([3, 16, 24, 26, 36, 40], $historicalDrawing->numberSets[0]->numbers);
        $this->assertSame('bonus', $historicalDrawing->numberSets[1]->type);
        $this->assertSame([27], $historicalDrawing->numberSets[1]->numbers);
        $this->assertSame('match_5_plus_1', $historicalDrawing->prizes[3]->tier);
        $this->assertNull($historicalDrawing->prizes[3]->amount);

        $currentDrawing = $drawings[2];
        $this->assertCount(1, $currentDrawing->numberSets);
        $this->assertNotContains('match_5_plus_1', array_column($currentDrawing->prizes, 'tier'));
        $this->assertCount(1, $drawings[1]->numberSets);
        $this->assertSame('main', $drawings[1]->numberSets[0]->type);

        $bonusWinner = $this->sixRecord(
            year: 2007,
            week: 29,
            date: '2007.07.22.',
            numbers: ['8', '13', '14', '17', '19', '45', '20'],
            winningPrize: true,
        );
        $bonusWinner = array_replace($bonusWinner, [
            '3HitCount' => '53123', '3HitPrize' => '952 Ft',
            '4HitCount' => '2651', '4HitPrize' => '5 450 Ft',
            '5HitCount' => '47', '5HitPrize' => '307 420 Ft',
            '5P1HitCount' => '1', '5P1HitPrize' => '29 525 700 Ft',
            '6HitCount' => '0', '6HitPrize' => '0 Ft',
        ]);
        $bonusDrawing = $this->normalizer->normalize('six', ['drawings' => [$bonusWinner]])[0];
        $this->assertSame('29525700.00', $bonusDrawing->prizes[3]->amount);
    }

    public function test_scandinavian_sets_remain_separate_and_may_overlap(): void
    {
        $record = $this->scandinavianRecord(
            year: 2026,
            week: 41,
            date: '2026.10.07.',
            numbers: ['1', '6', '10', '12', '14', '17', '33', '9', '11', '19', '20', '29', '31', '33'],
        );

        $drawing = $this->normalizer->normalize('scandinavian', ['drawings' => [$record]])[0];

        $this->assertCount(2, $drawing->numberSets);
        $this->assertSame('machine', $drawing->numberSets[0]->type);
        $this->assertSame([1, 6, 10, 12, 14, 17, 33], $drawing->numberSets[0]->numbers);
        $this->assertSame('manual', $drawing->numberSets[1]->type);
        $this->assertSame([9, 11, 19, 20, 29, 31, 33], $drawing->numberSets[1]->numbers);
    }

    public function test_dated_same_week_drawings_have_distinct_keys_independent_of_record_order_and_prizes(): void
    {
        $first = $this->sixRecord(2026, 40, '2026.10.04.', ['11', '13', '18', '19', '23', '34']);
        $second = $this->sixRecord(2026, 40, '2026.10.01.', ['1', '9', '19', '25', '38', '43']);
        $original = $this->normalizer->normalize('six', ['drawings' => [$first, $second]]);

        $first['3HitCount'] = '23549';
        $first['3HitPrize'] = '3 080 Ft';
        $first['numbers'] = array_reverse($first['numbers']);
        $reordered = $this->normalizer->normalize('six', ['drawings' => [$second, $first]]);

        $this->assertCount(2, $original);
        $this->assertSame(
            array_column($original, 'sourceKey'),
            array_column($reordered, 'sourceKey'),
        );
        $this->assertSame(['date:2026-10-01', 'date:2026-10-04'], array_column($original, 'sourceKey'));
    }

    public function test_undated_key_is_stable_across_number_whitespace_order_and_prize_corrections(): void
    {
        $record = $this->fiveRecord(1957, 10, '', ['16', '61', '71', '77', '89']);
        $originalKey = $this->normalizer->normalize('five', ['drawings' => [$record]])[0]->sourceKey;

        $record['numbers'] = ['89 ', '16', '77', '61 ', '71'];
        $record['2HitCount'] = '4';
        $record['2HitPrize'] = '500 Ft';
        $correctedKey = $this->normalizer->normalize('five', ['drawings' => [$record]])[0]->sourceKey;

        $this->assertSame($originalKey, $correctedKey);
    }

    public function test_exact_duplicate_records_are_deduplicated_and_conflicting_same_date_records_fail(): void
    {
        $record = $this->fiveRecord(2026, 40, '2026.10.03.', ['9', '48', '51', '83', '88'], true);

        $this->assertCount(1, $this->normalizer->normalize('five', ['drawings' => [$record, $record]]));

        $conflict = $record;
        $conflict['numbers'] = ['10', '48', '51', '83', '88'];
        $this->assertNormalizationFailure('five', ['drawings' => [$record, $conflict]], 1, 'source_key');
    }

    public function test_single_zero_prize_tier_is_kept_when_other_tiers_have_data(): void
    {
        $record = $this->fiveRecord(2026, 40, '2026.10.03.', ['9', '48', '51', '83', '88'], true);
        $record['5HitCount'] = '0';
        $record['5HitPrize'] = '0 Ft';

        $drawing = $this->normalizer->normalize('five', ['drawings' => [$record]])[0];

        $this->assertSame(0, $drawing->prizes[3]->winnerCount);
        $this->assertSame('0.00', $drawing->prizes[3]->amount);
    }

    public function test_missing_prize_fields_do_not_create_tiers(): void
    {
        $record = $this->fiveRecord(2026, 40, '2026.10.03.', ['9', '48', '51', '83', '88'], true);
        unset($record['2HitCount'], $record['2HitPrize']);

        $drawing = $this->normalizer->normalize('five', ['drawings' => [$record]])[0];

        $this->assertNotContains('match_2', array_column($drawing->prizes, 'tier'));
    }

    public function test_invalid_payloads_games_records_numbers_dates_and_prizes_fail_with_context(): void
    {
        $this->assertNormalizationFailure('unknown', ['drawings' => []], null, 'game_code');
        $this->assertNormalizationFailure('five', [], null, 'drawings');
        $this->assertNormalizationFailure('five', ['drawings' => []], null, 'drawings');
        $this->assertNormalizationFailure('five', ['drawings' => ['bad']], 0, 'record');

        $badNumbers = $this->fiveRecord(2026, 40, '2026.10.03.', ['9', '48', '51', '83', '83']);
        $this->assertNormalizationFailure('five', ['drawings' => [$badNumbers]], 0, 'numbers');

        $outOfRange = $this->fiveRecord(2026, 40, '2026.10.03.', ['9', '48', '51', '83', '91']);
        $this->assertNormalizationFailure('five', ['drawings' => [$outOfRange]], 0, 'numbers[4]');

        $badBonus = $this->sixRecord(1988, 43, '', ['3', '16', '24', '26', '36', '40', '40']);
        $this->assertNormalizationFailure('six', ['drawings' => [$badBonus]], 0, 'numbers[6]');

        $badScandinavian = $this->scandinavianRecord(2026, 41, '2026.10.07.', ['1', '6', '10', '12', '14', '17', '36', '9', '11', '19', '20', '29', '31', '33']);
        $this->assertNormalizationFailure('scandinavian', ['drawings' => [$badScandinavian]], 0, 'numbers[0..6][6]');

        $badDate = $this->fiveRecord(2026, 40, '2026.02.30.', ['9', '48', '51', '83', '88']);
        $this->assertNormalizationFailure('five', ['drawings' => [$badDate]], 0, 'date');

        $badPrize = $this->fiveRecord(2026, 40, '2026.10.03.', ['9', '48', '51', '83', '88'], true);
        $badPrize['3HitPrize'] = '-10 Ft';
        $this->assertNormalizationFailure('five', ['drawings' => [$badPrize]], 0, '3HitPrize');
    }

    /** @param array<string, mixed> $payload */
    private function assertNormalizationFailure(string $gameCode, array $payload, ?int $recordIndex, string $field): void
    {
        try {
            $this->normalizer->normalize($gameCode, $payload);
            self::fail('Expected source normalization to fail.');
        } catch (LotteryNormalizationException $exception) {
            $this->assertSame($gameCode, $exception->gameCode);
            $this->assertSame($recordIndex, $exception->recordIndex);
            $this->assertSame($field, $exception->field);
            $this->assertStringNotContainsString('numbers"', $exception->getMessage());
        }
    }

    /** @param list<mixed> $numbers @return array<string, mixed> */
    private function fiveRecord(int $year, int $week, string $date, array $numbers, bool $winningPrize = false): array
    {
        return [
            'year' => $year,
            'week' => $week,
            'date' => $date,
            'numbers' => $numbers,
            '2HitCount' => $winningPrize ? '52190' : '0',
            '2HitPrize' => $winningPrize ? '4 540 Ft' : '0 Ft',
            '3HitCount' => $winningPrize ? '1629' : '0',
            '3HitPrize' => $winningPrize ? '41 225 Ft' : '0 Ft',
            '4HitCount' => $winningPrize ? '15' : '0',
            '4HitPrize' => $winningPrize ? '4 213 545 Ft' : '0 Ft',
            '5HitCount' => '0',
            '5HitPrize' => '0 Ft',
        ];
    }

    /** @param list<mixed> $numbers @return array<string, mixed> */
    private function sixRecord(int $year, int $week, string $date, array $numbers, bool $winningPrize = false): array
    {
        return [
            'year' => $year,
            'week' => $week,
            'date' => $date,
            'numbers' => $numbers,
            '3HitCount' => '12645',
            '3HitPrize' => '4 215 Ft',
            '4HitCount' => '743',
            '4HitPrize' => '15 515 Ft',
            '5HitCount' => '13',
            '5HitPrize' => '886 640 Ft',
            '5P1HitCount' => $winningPrize ? '1' : 0,
            '5P1HitPrize' => $winningPrize ? '29 525 700 Ft' : 0,
            '6HitCount' => '0',
            '6HitPrize' => '0 Ft',
        ];
    }

    /** @param list<mixed> $numbers @return array<string, mixed> */
    private function scandinavianRecord(int $year, int $week, string $date, array $numbers, bool $winningPrize = false): array
    {
        return [
            'year' => $year,
            'week' => $week,
            'date' => $date,
            'numbers' => $numbers,
            '4HitCount' => '31118',
            '4HitPrize' => '2 965 Ft',
            '5HitCount' => '2200',
            '5HitPrize' => '9 535 Ft',
            '6HitCount' => '42',
            '6HitPrize' => '499 575 Ft',
            '7HitCount' => $winningPrize ? '1' : '0',
            '7HitPrize' => $winningPrize ? '1 000 000 Ft' : '0 Ft',
        ];
    }
}
