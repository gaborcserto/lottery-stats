<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['drawing_id', 'tier', 'winner_count', 'amount', 'currency'])]
class DrawingPrize extends Model
{
    /** @return BelongsTo<Drawing, $this> */
    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'winner_count' => 'integer',
            'amount' => 'decimal:2',
        ];
    }
}
