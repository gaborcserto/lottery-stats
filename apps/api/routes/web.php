<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/api-docs', function () {
    abort_unless(config('api.docs_enabled'), 404);

    return view('api-docs');
})->withoutMiddleware('web');

Route::get('/api-docs/openapi.json', function () {
    abort_unless(config('api.docs_enabled'), 404);

    return response()->file(resource_path('openapi.json'), ['Content-Type' => 'application/json']);
})->withoutMiddleware('web');
