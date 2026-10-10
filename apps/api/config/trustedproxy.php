<?php

return [
    // Keep an explicit empty list: even hosted-platform defaults must not trust all peers.
    'proxies' => array_values(array_filter(array_map(trim(...), explode(',', (string) env('TRUSTED_PROXIES', ''))))),
];
