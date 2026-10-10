<?php

return [
    'requests_per_minute' => (int) env('API_RATE_LIMIT_PER_MINUTE', 60),
    'docs_enabled' => (bool) env('API_DOCS_ENABLED', env('APP_ENV', 'production') === 'local'),
];
