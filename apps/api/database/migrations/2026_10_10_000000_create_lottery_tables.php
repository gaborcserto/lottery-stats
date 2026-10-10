<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('drawings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->string('source_key', 191);
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('week');
            $table->date('drawn_on')->nullable();
            $table->timestamps();

            $table->unique(['game_id', 'source_key']);
            $table->index(['game_id', 'year', 'week']);
            $table->index(['game_id', 'drawn_on']);
        });

        Schema::create('drawing_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drawing_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->timestamps();

            $table->unique(['drawing_id', 'type']);
        });

        Schema::create('drawing_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drawing_set_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('number');
            $table->timestamps();

            $table->unique(['drawing_set_id', 'number']);
            $table->index('number');
        });

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::unprepared("CREATE TRIGGER drawing_numbers_number_must_be_positive_insert BEFORE INSERT ON drawing_numbers WHEN NEW.number < 1 BEGIN SELECT RAISE(ABORT, 'drawing number must be positive'); END");
            DB::unprepared("CREATE TRIGGER drawing_numbers_number_must_be_positive_update BEFORE UPDATE OF number ON drawing_numbers WHEN NEW.number < 1 BEGIN SELECT RAISE(ABORT, 'drawing number must be positive'); END");
        } else {
            DB::statement('ALTER TABLE drawing_numbers ADD CONSTRAINT drawing_numbers_number_positive CHECK (number > 0)');
        }

        Schema::create('drawing_prizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drawing_id')->constrained()->cascadeOnDelete();
            $table->string('tier', 32);
            $table->unsignedInteger('winner_count')->nullable();
            $table->decimal('amount', 14, 2)->nullable();
            $table->char('currency', 3)->nullable();
            $table->timestamps();

            $table->unique(['drawing_id', 'tier']);
        });

        Schema::create('game_import_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamp('last_succeeded_at')->nullable();
            $table->string('status', 16)->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamps();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_import_states');
        Schema::dropIfExists('drawing_prizes');
        Schema::dropIfExists('drawing_numbers');
        Schema::dropIfExists('drawing_sets');
        Schema::dropIfExists('drawings');
        Schema::dropIfExists('games');
    }
};
