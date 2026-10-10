<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\GameResource;
use App\Models\Game;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GameController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $codes = array_keys(config('lottery.sources'));

        return GameResource::collection(Game::query()->whereIn('code', $codes)->orderByRaw(
            'CASE code '.implode(' ', array_map(
                fn (string $code, int $index): string => "WHEN '{$code}' THEN {$index}",
                $codes,
                array_keys($codes),
            )).' END'
        )->get());
    }

    public function show(string $game): GameResource
    {
        return new GameResource($this->findGame($game));
    }

    private function findGame(string $code): Game
    {
        abort_unless(in_array($code, array_keys(config('lottery.sources')), true), 404);

        return Game::query()->where('code', $code)->firstOrFail();
    }
}
