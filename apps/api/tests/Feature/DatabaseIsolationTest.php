<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseIsolationTest extends TestCase
{
    public function test_database_connection_uses_in_memory_sqlite(): void
    {
        $connection = DB::connection();

        $this->assertSame('testing', app()->environment());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', $connection->getDatabaseName());
        $this->assertSame('sqlite', $connection->getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME));
    }
}
