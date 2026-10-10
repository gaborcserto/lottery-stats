<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['game_id', 'source_key', 'year', 'week', 'drawn_on'])]
class Drawing extends Model
{
    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /** @return HasMany<DrawingSet, $this> */
    public function sets(): HasMany
    {
        return $this->hasMany(DrawingSet::class);
    }

    /** @return HasMany<DrawingPrize, $this> */
    public function prizes(): HasMany
    {
        return $this->hasMany(DrawingPrize::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'week' => 'integer',
            'drawn_on' => 'date',
        ];
    }
}
