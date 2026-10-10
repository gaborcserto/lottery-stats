<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['drawing_id', 'type'])]
class DrawingSet extends Model
{
    /** @return BelongsTo<Drawing, $this> */
    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class);
    }

    /** @return HasMany<DrawingNumber, $this> */
    public function numbers(): HasMany
    {
        return $this->hasMany(DrawingNumber::class);
    }
}
