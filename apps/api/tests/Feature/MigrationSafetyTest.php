<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MigrationSafetyTest extends TestCase
{
    public function test_migrations_can_be_rolled_back_and_reapplied_on_in_memory_sqlite(): void
    {
        $connection = DB::connection();

        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame('sqlite', $connection->getDriverName());
        $this->assertSame('sqlite', $connection->getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME));
        $this->assertSame(':memory:', $connection->getDatabaseName());
        $this->assertSame('', config('database.connections.sqlite.url'));

        $this->assertSame(0, Artisan::call('migrate:fresh', ['--force' => true]));
        $this->assertTrue($connection->getSchemaBuilder()->hasTable('games'));

        $this->assertSame(0, Artisan::call('migrate:rollback', ['--force' => true]));
        $this->assertFalse($connection->getSchemaBuilder()->hasTable('games'));

        $this->assertSame(0, Artisan::call('migrate', ['--force' => true]));
        $this->assertTrue($connection->getSchemaBuilder()->hasTable('games'));
        $this->assertSame(':memory:', $connection->getDatabaseName());
    }
}
