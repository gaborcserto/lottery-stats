<?php

return [
    'sources' => [
        'five' => env('LOTTERY_FIVE_URL', 'https://bet.szerencsejatek.hu/cmsfiles/otos.json'),
        'six' => env('LOTTERY_SIX_URL', 'https://bet.szerencsejatek.hu/cmsfiles/hatos.json'),
        'scandinavian' => env('LOTTERY_SCANDINAVIAN_URL', 'https://bet.szerencsejatek.hu/cmsfiles/skandi.json'),
    ],

    'sync' => [
        'auto' => env('LOTTERY_AUTO_SYNC', false),
        'interval_hours' => env('LOTTERY_SYNC_INTERVAL_HOURS', 24),
        'connect_timeout_seconds' => env('LOTTERY_CONNECT_TIMEOUT_SECONDS', 5),
        'request_timeout_seconds' => env('LOTTERY_REQUEST_TIMEOUT_SECONDS', 30),
        'retry_attempts' => env('LOTTERY_RETRY_ATTEMPTS', 3),
        'retry_delay_milliseconds' => env('LOTTERY_RETRY_DELAY_MILLISECONDS', 250),
        'max_response_bytes' => env('LOTTERY_MAX_RESPONSE_BYTES', 16 * 1024 * 1024),
        'lock_seconds' => env('LOTTERY_SYNC_LOCK_SECONDS', 900),
        'startup_schema_wait_seconds' => env('LOTTERY_STARTUP_SCHEMA_WAIT_SECONDS', 120),
    ],
];
