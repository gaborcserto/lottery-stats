<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StatisticsRequest;
use App\Lottery\LotteryStatistics;
use Illuminate\Http\JsonResponse;

class StatisticsController extends Controller
{
    public function __invoke(StatisticsRequest $request, LotteryStatistics $statistics): JsonResponse
    {
        return response()->json($statistics->calculate(
            $request->game(),
            (string) $request->route('metric'),
            $request->validated(),
            $request->maximumNumber(),
        ));
    }
}
