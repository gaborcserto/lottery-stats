<?php

namespace Database\Seeders;

use App\Models\Game;
use Illuminate\Database\Seeder;

class GameSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'five' => 'Ötöslottó',
            'six' => 'Hatoslottó',
            'scandinavian' => 'Skandináv lottó',
        ] as $code => $name) {
            Game::query()->updateOrCreate(['code' => $code], ['name' => $name]);
        }
    }
}
