<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Drawing;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DrawingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Drawing $drawing */
        $drawing = $this->resource;

        return [
            'id' => $drawing->id,
            'year' => $drawing->year,
            'week' => $drawing->week,
            'drawn_on' => $drawing->getRawOriginal('drawn_on') === null
                ? null
                : Carbon::parse($drawing->getRawOriginal('drawn_on'))->toDateString(),
            'sets' => $drawing->sets->map(fn ($set): array => [
                'type' => $set->type,
                'numbers' => $set->numbers->pluck('number')->values(),
            ])->values(),
            'prizes' => $drawing->prizes->map(fn ($prize): array => [
                'tier' => $prize->tier,
                'winner_count' => $prize->winner_count,
                'amount' => $prize->amount,
                'currency' => $prize->currency,
            ])->values(),
        ];
    }
}
