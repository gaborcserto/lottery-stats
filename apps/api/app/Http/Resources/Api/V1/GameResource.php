<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GameResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Game $game */
        $game = $this->resource;

        return [
            'code' => $game->code,
            'name' => $game->name,
        ];
    }
}
