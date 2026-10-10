# Lottery Stats API

This application provides the Laravel 13 / PHP 8.5 backend for the planned read-only lottery API, backed by SQLite. Official drawings can be synchronized through Artisan; lottery API routes and statistics are not implemented yet.

See the [project README](../../README.md) for Docker Compose setup, backend quality commands, testing, and security requirements. Coding agents should follow the shared [AGENTS.md](../../AGENTS.md).

## Database safety

The persistent development database is `database/database.sqlite`, selected by the local `.env`. PHPUnit uses isolated SQLite `:memory:` settings from `phpunit.xml`; `.env.testing` also explicitly selects `:memory:` for Artisan commands. A disposable migration-verification database exists only inside the isolated PHPUnit process.

Verify migrations and rollback with `docker compose exec api composer test -- --filter=MigrationSafetyTest`. The test checks the effective driver, database target, and URL before running `migrate:fresh` and `migrate:rollback`, then reapplies migrations on the same in-memory connection. Never run destructive commands unless you have explicitly verified that the effective connection and target are disposable. `--env=testing` alone does not guarantee isolation. Treat `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, and any table-drop or truncation command as destructive. Never use them against the persistent development database for verification.

## Lottery data sources

`config/lottery.php` maps the stable game codes `five`, `six`, and `scandinavian` to their official JSON source URLs. Set `LOTTERY_FIVE_URL`, `LOTTERY_SIX_URL`, or `LOTTERY_SCANDINAVIAN_URL` in the environment to override a game's source independently; runtime validation still requires the exact official HTTPS host and game path.

Run `php artisan lottery:sync` for all games, add a game code for one game, or add `--force` to bypass the configured 24-hour freshness interval. `php artisan lottery:sync --status` shows per-game timestamps and state without fetching. A failed fetch, invalid feed, or persistence error keeps existing historical records and the previous successful timestamp.

Local Docker startup synchronization is off by default. Set `LOTTERY_AUTO_SYNC=true` to enable the separate one-shot Compose service; `LOTTERY_SYNC_INTERVAL_HOURS` changes the freshness interval. It runs only in the `local` environment, never during PHPUnit, and does not block the API or Vite. It waits for the schema but never runs migrations. On a new checkout, run `docker compose exec api php artisan migrate --seed`; if the one-shot process timed out first, restart it with `docker compose up -d lottery-sync`.

Essential source identity, historical-data, prize-precision, and import-safety decisions are summarized in the [project README](../../README.md#lottery-data-integrity). Optional detailed engineering notes may exist in the ignored root `.notes/` directory.
