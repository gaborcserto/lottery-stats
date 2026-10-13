<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seeder_can_run_twice_without_creating_sample_users_or_duplicate_games(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('games', 3);
        $this->assertDatabaseHas('games', ['code' => 'five', 'name' => "\u{00D6}t\u{00F6}slott\u{00F3}"]);
        $this->assertDatabaseHas('games', ['code' => 'six', 'name' => "Hatoslott\u{00F3}"]);
        $this->assertDatabaseHas('games', ['code' => 'scandinavian', 'name' => "Skandin\u{00E1}v lott\u{00F3}"]);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseMissing('users', ['email' => 'test@example.com']);
    }

    public function test_default_seeder_leaves_existing_users_untouched(): void
    {
        $user = User::factory()->create([
            'name' => 'Existing User',
            'email' => 'test@example.com',
        ]);

        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Existing User',
            'email' => 'test@example.com',
        ]);
    }
}
