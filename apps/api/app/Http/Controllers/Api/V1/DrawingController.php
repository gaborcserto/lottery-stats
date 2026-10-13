<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\DrawingListRequest;
use App\Http\Resources\Api\V1\DrawingResource;
use App\Http\Resources\Api\V1\DrawingSummaryResource;
use App\Lottery\DrawingFilters;
use App\Models\Drawing;
use App\Models\Game;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DrawingController extends Controller
{
    public function index(DrawingListRequest $request): AnonymousResourceCollection
    {
        $validated = $request->validated();

        $query = $this->orderedDrawings($request->game());
        DrawingFilters::apply($query, $validated);

        $resource = DrawingSummaryResource::class;
        if (($validated['include'] ?? null) === 'details') {
            $query->with($this->detailRelations());
            $resource = DrawingResource::class;
        }

        return $resource::collection($query->paginate(
            (int) ($validated['per_page'] ?? 20),
            ['*'],
            'page',
            (int) ($validated['page'] ?? 1),
        ));
    }

    public function latest(string $game): DrawingResource
    {
        $drawing = $this->orderedDrawings($this->findGame($game))
            ->with($this->detailRelations())
            ->firstOrFail();

        return new DrawingResource($drawing);
    }

    public function show(string $game, string $drawing): DrawingResource
    {
        if (strlen($drawing) > strlen((string) PHP_INT_MAX)
            || (strlen($drawing) === strlen((string) PHP_INT_MAX) && strcmp($drawing, (string) PHP_INT_MAX) > 0)) {
            abort(404);
        }

        $record = $this->findGame($game)->drawings()
            ->with($this->detailRelations())
            ->whereKey($drawing)
            ->firstOrFail();

        return new DrawingResource($record);
    }

    private function findGame(string $code): Game
    {
        abort_unless(in_array($code, array_keys(config('lottery.sources')), true), 404);

        return Game::query()->where('code', $code)->firstOrFail();
    }

    /** @return array<string, \Closure> */
    private function detailRelations(): array
    {
        return [
            'sets' => fn ($query) => $query->orderByRaw("CASE type WHEN 'main' THEN 0 WHEN 'bonus' THEN 1 WHEN 'machine' THEN 2 WHEN 'manual' THEN 3 ELSE 4 END"),
            'sets.numbers' => fn ($query) => $query->orderBy('number'),
            'prizes' => fn ($query) => $query->orderBy('tier'),
        ];
    }

    /**
     * Order by source year and week, then prefer dated records and use date and
     * database ID as deterministic tie breakers. ID does not imply draw order.
     *
     * @return HasMany<Drawing, Game>
     */
    private function orderedDrawings(Game $game): HasMany
    {
        return $game->drawings()
            ->orderByDesc('year')
            ->orderByDesc('week')
            ->orderByRaw('drawn_on IS NULL ASC')
            ->orderByDesc('drawn_on')
            ->orderByDesc('id');
    }
}
