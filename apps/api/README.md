# Lottery Stats API

This application provides the Laravel 13 / PHP 8.5 foundation for the planned read-only lottery API, backed by SQLite. Lottery routes, imports, and statistics are not implemented yet.

See the [project README](../../README.md) for Docker Compose setup, backend quality commands, testing, and security requirements. Coding agents should follow the shared [AGENTS.md](../../AGENTS.md).

## Database safety

The persistent development database is `database/database.sqlite`, selected by the local `.env`. PHPUnit uses isolated SQLite `:memory:` settings from `phpunit.xml`; `.env.testing` also explicitly selects `:memory:` for Artisan commands. A disposable migration-verification database exists only inside the isolated PHPUnit process.

Verify migrations and rollback with `docker compose exec api composer test -- --filter=MigrationSafetyTest`. The test checks the effective driver, database target, and URL before running `migrate:fresh` and `migrate:rollback`, then reapplies migrations on the same in-memory connection. Never run destructive commands unless you have explicitly verified that the effective connection and target are disposable. `--env=testing` alone does not guarantee isolation. Treat `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, and any table-drop or truncation command as destructive. Never use them against the persistent development database for verification.

## Lottery data sources

`config/lottery.php` maps the stable game codes `five`, `six`, and `scandinavian` to their official JSON source URLs. Set `LOTTERY_FIVE_URL`, `LOTTERY_SIX_URL`, or `LOTTERY_SCANDINAVIAN_URL` in the environment to override a game's source independently; application code reads these values through Laravel configuration.

Laravel will fetch and persist validated lottery data in SQLite, which remains the source of truth. React will consume the Laravel API and will not fetch lottery feeds directly. A failed fetch or invalid feed must preserve existing historical records. HTTP timeouts, retries, response-size limits, normalization, and validation are for later implementation phases.

Essential source identity, historical-data, prize-precision, and import-safety decisions are summarized in the [project README](../../README.md#lottery-data-integrity). Optional detailed engineering notes may exist in the ignored root `.notes/` directory.
