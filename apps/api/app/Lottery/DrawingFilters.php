<?php

namespace App\Lottery;

use App\Models\Drawing;
use App\Models\Game;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Query\Builder;

class DrawingFilters
{
    /** @return array<string, list<string>> */
    public static function rules(): array
    {
        return [
            'year' => ['sometimes', 'integer', 'min:1', 'max:9999'],
            'week' => ['sometimes', 'integer', 'min:1', 'max:53'],
            'from_date' => ['sometimes', 'date_format:Y-m-d'],
            'to_date' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from_date'],
        ];
    }

    /**
     * @param  HasMany<Drawing, Game>|Builder  $query
     * @param  array<string, mixed>  $filters
     */
    public static function apply(HasMany|Builder $query, array $filters, string $prefix = ''): void
    {
        foreach (['year', 'week'] as $field) {
            if (isset($filters[$field])) {
                $query->where($prefix.$field, $filters[$field]);
            }
        }
        foreach (['from_date' => '>=', 'to_date' => '<='] as $field => $operator) {
            if (isset($filters[$field])) {
                $query->whereNotNull($prefix.'drawn_on')->whereDate($prefix.'drawn_on', $operator, $filters[$field]);
            }
        }
    }
}
