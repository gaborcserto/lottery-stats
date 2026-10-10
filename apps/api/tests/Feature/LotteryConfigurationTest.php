<?php

namespace Tests\Feature;

use App\Models\Game;
use Database\Seeders\GameSeeder;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LotteryConfigurationTest extends TestCase
{
    use RefreshDatabase;

    private const OFFICIAL_URLS = [
        'five' => 'https://bet.szerencsejatek.hu/cmsfiles/otos.json',
        'six' => 'https://bet.szerencsejatek.hu/cmsfiles/hatos.json',
        'scandinavian' => 'https://bet.szerencsejatek.hu/cmsfiles/skandi.json',
    ];

    public function test_configuration_contains_only_the_expected_games_and_official_https_urls(): void
    {
        $sources = config('lottery.sources');

        $this->assertInstanceOf(Repository::class, app('config'));
        $this->assertSame(self::OFFICIAL_URLS, $sources);
        $this->assertSame(array_keys(self::OFFICIAL_URLS), array_keys($sources));

        foreach ($sources as $url) {
            $this->assertIsString($url);
            $this->assertNotFalse(filter_var($url, FILTER_VALIDATE_URL));
            $this->assertSame('https', parse_url($url, PHP_URL_SCHEME));
            $this->assertSame('bet.szerencsejatek.hu', parse_url($url, PHP_URL_HOST));
        }

        $this->seed(GameSeeder::class);
        $gameCodes = Game::query()->orderBy('code')->pluck('code')->all();
        $configuredCodes = array_keys($sources);
        sort($configuredCodes);

        $this->assertSame($gameCodes, $configuredCodes);
    }

    public function test_each_source_can_be_overridden_through_its_environment_variable(): void
    {
        $overrides = [
            'LOTTERY_FIVE_URL' => 'https://example.test/five.json',
            'LOTTERY_SIX_URL' => 'https://example.test/six.json',
            'LOTTERY_SCANDINAVIAN_URL' => 'https://example.test/scandinavian.json',
        ];
        $previous = [];

        foreach ($overrides as $key => $value) {
            $previous[$key] = [
                'process' => getenv($key),
                'env_exists' => array_key_exists($key, $_ENV),
                'env' => $_ENV[$key] ?? null,
                'server_exists' => array_key_exists($key, $_SERVER),
                'server' => $_SERVER[$key] ?? null,
            ];
        }

        try {
            foreach ($overrides as $key => $value) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }

            $configuration = require config_path('lottery.php');

            $this->assertSame([
                'five' => $overrides['LOTTERY_FIVE_URL'],
                'six' => $overrides['LOTTERY_SIX_URL'],
                'scandinavian' => $overrides['LOTTERY_SCANDINAVIAN_URL'],
            ], $configuration['sources']);
        } finally {
            foreach ($previous as $key => $values) {
                if ($values['process'] === false) {
                    putenv($key);
                } else {
                    putenv("{$key}={$values['process']}");
                }

                if ($values['env_exists']) {
                    $_ENV[$key] = $values['env'];
                } else {
                    unset($_ENV[$key]);
                }

                if ($values['server_exists']) {
                    $_SERVER[$key] = $values['server'];
                } else {
                    unset($_SERVER[$key]);
                }
            }
        }
    }
}
