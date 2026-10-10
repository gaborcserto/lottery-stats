<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['drawing_set_id', 'number'])]
class DrawingNumber extends Model
{
    /** @return BelongsTo<DrawingSet, $this> */
    public function drawingSet(): BelongsTo
    {
        return $this->belongsTo(DrawingSet::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['number' => 'integer'];
    }
}
