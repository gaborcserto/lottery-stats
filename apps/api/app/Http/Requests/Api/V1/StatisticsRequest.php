<?php

namespace App\Http\Requests\Api\V1;

use App\Lottery\DrawingFilters;
use App\Models\Game;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StatisticsRequest extends FormRequest
{
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
        $rules = DrawingFilters::rules();
        $rules['set'] = ['sometimes', 'string', Rule::in(
            $this->gameModel->code === 'scandinavian' ? ['machine', 'manual', 'combined'] : ['main'],
        )];
        if ($this->route('metric') === 'frequencies') {
            $rules['sort'] = ['sometimes', 'string', Rule::in(['number', 'most', 'least'])];
            $rules['limit'] = ['sometimes', 'integer', 'min:1', 'max:90'];
        }
        if ($this->route('metric') === 'pairs') {
            $rules['limit'] = ['sometimes', 'integer', 'min:1', 'max:100'];
        }
        if ($this->route('metric') === 'yearly') {
            $rules['number'] = ['sometimes', 'integer', 'min:1', 'max:'.$this->maximumNumber()];
        }

        return $rules;
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

    public function maximumNumber(): int
    {
        return match ($this->gameModel->code) {
            'five' => 90,
            'six' => 45,
            default => 35,
        };
    }
}
