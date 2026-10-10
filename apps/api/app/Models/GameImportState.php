<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['game_id', 'last_attempted_at', 'last_succeeded_at', 'status', 'error_message'])]
class GameImportState extends Model
{
    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'last_attempted_at' => 'datetime',
            'last_succeeded_at' => 'datetime',
        ];
    }
}
