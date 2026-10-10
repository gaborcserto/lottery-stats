<?php

use App\Http\Controllers\Api\V1\DrawingController;
use App\Http\Controllers\Api\V1\GameController;
use App\Http\Controllers\Api\V1\StatisticsController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('games', [GameController::class, 'index']);
    Route::get('games/{game}', [GameController::class, 'show']);
    foreach (['summary', 'frequencies', 'parity', 'pairs', 'yearly'] as $metric) {
        $path = $metric === 'yearly' ? 'trends/yearly' : $metric;
        Route::get('games/{game}/statistics/'.$path, StatisticsController::class)->defaults('metric', $metric);
    }
    Route::get('games/{game}/drawings', [DrawingController::class, 'index']);
    Route::get('games/{game}/drawings/latest', [DrawingController::class, 'latest']);
    Route::get('games/{game}/drawings/{drawing}', [DrawingController::class, 'show'])
        ->whereNumber('drawing');
});
