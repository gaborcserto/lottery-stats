<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['code', 'name'])]
class Game extends Model
{
    /** @return HasMany<Drawing, $this> */
    public function drawings(): HasMany
    {
        return $this->hasMany(Drawing::class);
    }

    /** @return HasOne<GameImportState, $this> */
    public function importState(): HasOne
    {
        return $this->hasOne(GameImportState::class);
    }
}
