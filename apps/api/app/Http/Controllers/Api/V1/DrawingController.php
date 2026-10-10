<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\DrawingResource;
use App\Http\Resources\Api\V1\DrawingSummaryResource;
use App\Models\Drawing;
use App\Models\Game;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Validator;

class DrawingController extends Controller
{
    public function index(Request $request, string $game): AnonymousResourceCollection
    {
        $gameModel = $this->findGame($game);
        $validator = Validator::make($request->query(), [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'year' => ['sometimes', 'integer', 'min:1', 'max:9999'],
            'week' => ['sometimes', 'integer', 'min:1', 'max:53'],
            'from_date' => ['sometimes', 'date_format:Y-m-d'],
            'to_date' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from_date'],
        ])->after(function ($validator) use ($request): void {
            foreach (array_diff(array_keys($request->query()), [
                'page', 'per_page', 'year', 'week', 'from_date', 'to_date',
            ]) as $parameter) {
                $validator->errors()->add($parameter, 'This query parameter is not supported.');
            }
        });
        $validated = $validator->validate();

        $query = $this->orderedDrawings($gameModel);
        if (isset($validated['year'])) {
            $query->where('year', $validated['year']);
        }
        if (isset($validated['week'])) {
            $query->where('week', $validated['week']);
        }
        if (isset($validated['from_date'])) {
            $query->whereNotNull('drawn_on')->whereDate('drawn_on', '>=', $validated['from_date']);
        }
        if (isset($validated['to_date'])) {
            $query->whereNotNull('drawn_on')->whereDate('drawn_on', '<=', $validated['to_date']);
        }

        return DrawingSummaryResource::collection($query->paginate(
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

    public function show(string $game, int $drawing): DrawingResource
    {
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
