<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Drawing;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DrawingSummaryResource extends JsonResource
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
        ];
    }
}
