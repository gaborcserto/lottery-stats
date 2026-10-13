<?php

namespace App\Http\Requests\Api\V1;

use App\Lottery\DrawingFilters;
use App\Models\Game;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DrawingListRequest extends FormRequest
{
    private const MAX_PAGE = 1_000_000;

    private Game $gameModel;

    public function authorize(): bool
    {
        $code = $this->route('game');
        abort_unless(in_array($code, array_keys(config('lottery.sources')), true), 404);
        $this->gameModel = Game::query()->where('code', $code)->firstOrFail();

        return true;
    }

    public function game(): Game
    {
        return $this->gameModel;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1', 'max:'.self::MAX_PAGE],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'include' => ['sometimes', 'in:details'],
            ...DrawingFilters::rules(),
        ];
    }

    /** @return list<\Closure(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->query()), array_keys($this->rules())) as $parameter) {
                $validator->errors()->add($parameter, 'This query parameter is not supported.');
            }
        }];
    }
}
