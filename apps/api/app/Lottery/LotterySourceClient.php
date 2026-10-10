<?php

namespace App\Lottery;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use JsonException;
use Psr\Http\Message\ResponseInterface;
use Throwable;

final class LotterySourceClient
{
    private const ALLOWED_PATHS = [
        'five' => '/cmsfiles/otos.json',
        'six' => '/cmsfiles/hatos.json',
        'scandinavian' => '/cmsfiles/skandi.json',
    ];

    /** @return array<string, mixed> */
    public function retrieve(string $gameCode): array
    {
        $url = config("lottery.sources.{$gameCode}");
        if (! is_string($url) || ! $this->isAllowedUrl($gameCode, $url)) {
            throw new LotterySyncException('The configured lottery source is not allowed.');
        }

        $connectTimeout = $this->positiveInteger('connect_timeout_seconds');
        $requestTimeout = $this->positiveInteger('request_timeout_seconds');
        $attempts = $this->positiveInteger('retry_attempts', 5);
        $delay = $this->nonNegativeInteger('retry_delay_milliseconds', 10_000);
        $maximumBytes = $this->positiveInteger('max_response_bytes', 100 * 1024 * 1024);

        try {
            $response = Http::acceptJson()
                ->connectTimeout($connectTimeout)
                ->timeout($requestTimeout)
                ->retry(
                    $attempts,
                    static fn (int $attempt): int => $delay * $attempt,
                    static fn (Throwable $exception): bool => $exception instanceof ConnectionException
                        || ($exception instanceof RequestException && $exception->response->serverError()),
                )
                ->withOptions([
                    'allow_redirects' => false,
                    'on_headers' => static function (ResponseInterface $response) use ($maximumBytes): void {
                        $length = $response->getHeaderLine('Content-Length');
                        if ($length !== '' && ctype_digit($length) && (int) $length > $maximumBytes) {
                            throw new LotterySyncException('The lottery source response is too large.');
                        }
                    },
                    'progress' => static function (int $total, int $downloaded) use ($maximumBytes): void {
                        if ($total > $maximumBytes || $downloaded > $maximumBytes) {
                            throw new LotterySyncException('The lottery source response is too large.');
                        }
                    },
                ])
                ->get($url);
        } catch (LotterySyncException $exception) {
            throw $exception;
        } catch (ConnectionException) {
            throw new LotterySyncException('The lottery source could not be reached.');
        } catch (RequestException $exception) {
            throw new LotterySyncException('The lottery source returned HTTP '.$exception->response->status().'.');
        } catch (Throwable) {
            throw new LotterySyncException('The lottery source request failed.');
        }

        if ($response->redirect()) {
            throw new LotterySyncException('The lottery source returned an unexpected redirect.');
        }
        if (! $response->successful()) {
            throw new LotterySyncException('The lottery source returned HTTP '.$response->status().'.');
        }

        $contentType = strtolower($response->header('Content-Type'));
        if (! str_contains($contentType, 'json')) {
            throw new LotterySyncException('The lottery source did not return JSON content.');
        }

        $body = $response->body();
        if (strlen($body) > $maximumBytes) {
            throw new LotterySyncException('The lottery source response is too large.');
        }

        try {
            $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new LotterySyncException('The lottery source returned invalid JSON.');
        }

        if (! is_array($payload) || array_is_list($payload)) {
            throw new LotterySyncException('The lottery source JSON must be an object.');
        }

        return $payload;
    }

    private function isAllowedUrl(string $gameCode, string $url): bool
    {
        $parts = parse_url($url);

        return isset(self::ALLOWED_PATHS[$gameCode])
            && is_array($parts)
            && ($parts['scheme'] ?? null) === 'https'
            && ($parts['host'] ?? null) === 'bet.szerencsejatek.hu'
            && ($parts['path'] ?? null) === self::ALLOWED_PATHS[$gameCode]
            && ! isset($parts['port'], $parts['user'], $parts['pass'], $parts['query'], $parts['fragment']);
    }

    private function positiveInteger(string $key, int $maximum = PHP_INT_MAX): int
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

    private function nonNegativeInteger(string $key, int $maximum): int
    {
        $value = config("lottery.sync.{$key}");
        if (! is_int($value) && ! (is_string($value) && ctype_digit($value))) {
            throw new LotterySyncException("The lottery {$key} configuration is invalid.");
        }

        $value = (int) $value;
        if ($value < 0 || $value > $maximum) {
            throw new LotterySyncException("The lottery {$key} configuration is invalid.");
        }

        return $value;
    }
}
