# Lottery Stats API

This application provides the Laravel 13 / PHP 8.5 backend and read-only results API, backed by SQLite. Official drawings can be synchronized through Artisan. Statistical aggregations are planned for Phase 4.7.

See the [project README](../../README.md) for Docker Compose setup, backend quality commands, testing, and security requirements. Coding agents should follow the shared [AGENTS.md](../../AGENTS.md).

## Database safety

The persistent development database is `database/database.sqlite`, selected by the local `.env`. PHPUnit uses isolated SQLite `:memory:` settings from `phpunit.xml`; `.env.testing` also explicitly selects `:memory:` for Artisan commands. A disposable migration-verification database exists only inside the isolated PHPUnit process.

Verify migrations and rollback with `docker compose exec api composer test -- --filter=MigrationSafetyTest`. The test checks the effective driver, database target, and URL before running `migrate:fresh` and `migrate:rollback`, then reapplies migrations on the same in-memory connection. Never run destructive commands unless you have explicitly verified that the effective connection and target are disposable. `--env=testing` alone does not guarantee isolation. Treat `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, and any table-drop or truncation command as destructive. Never use them against the persistent development database for verification.

## Lottery data sources

`config/lottery.php` maps the stable game codes `five`, `six`, and `scandinavian` to their official JSON source URLs. Set `LOTTERY_FIVE_URL`, `LOTTERY_SIX_URL`, or `LOTTERY_SCANDINAVIAN_URL` in the environment to override a game's source independently; runtime validation still requires the exact official HTTPS host and game path.

Run `php artisan lottery:sync` for all games, add a game code for one game, or add `--force` to bypass the configured 24-hour freshness interval. `php artisan lottery:sync --status` shows per-game timestamps and state without fetching. A failed fetch, invalid feed, or persistence error keeps existing historical records and the previous successful timestamp.

Local Docker startup synchronization is off by default. Set `LOTTERY_AUTO_SYNC=true` to enable the separate one-shot Compose service; `LOTTERY_SYNC_INTERVAL_HOURS` changes the freshness interval. It runs only in the `local` environment, never during PHPUnit, and does not block the API or Vite. It waits for the schema but never runs migrations. On a new checkout, run `docker compose exec api php artisan migrate --seed`; if the one-shot process timed out first, restart it with `docker compose up -d lottery-sync`.

Essential source identity, historical-data, prize-precision, and import-safety decisions are summarized in the [project README](../../README.md#lottery-data-integrity). Optional detailed engineering notes may exist in the ignored root `.notes/` directory.

## Results API (`/api/v1`)

All endpoints return JSON. Game codes are `five`, `six`, and `scandinavian`; game resources expose only `code` and the stored Hungarian `name`. Drawing detail uses the numeric database drawing ID, scoped to its game.

| Method and path | Response |
| --- | --- |
| `GET /games` | `data` array of supported games |
| `GET /games/{game}` | One game in `data` |
| `GET /games/{game}/drawings` | Paginated drawing summaries |
| `GET /games/{game}/drawings/latest` | Latest drawing detail |
| `GET /games/{game}/drawings/{drawing}` | Drawing detail |

Drawing summaries contain `id`, `year`, `week`, and nullable `drawn_on`. Detail adds `sets` (each with a `type` and integer `numbers`) and `prizes` (each with `tier`, nullable `winner_count`, nullable decimal-string `amount`, and nullable `currency`). Five uses `main`; Six uses `main` and optional `bonus`; Scandinavian keeps `machine` and `manual` sets separate. Dates use `YYYY-MM-DD` ISO date format. For example:

```json
{
  "data": {
    "id": 123,
    "year": 2026,
    "week": 40,
    "drawn_on": null,
    "sets": [{"type": "main", "numbers": [1, 2, 3, 4, 5]}],
    "prizes": [{"tier": "match_5", "winner_count": null, "amount": "1250000.00", "currency": "HUF"}]
  }
}
```

The drawings list accepts `page` (default `1`), `per_page` (default `20`, maximum `100`), `year` (1–9999), `week` (1–53), `from_date`, and `to_date` (both `YYYY-MM-DD`, inclusive). Year/week filters include undated records. Date filters exclude records with a null date. Malformed values and reversed date ranges return `422` with Laravel's JSON validation errors. Unknown game codes and missing or cross-game drawing IDs return JSON `404`.

List and latest use the same descending source ordering: year, then week, with dated records ahead of undated records within a week, then date and numeric ID descending for stable ties. The ID tie-breaker does not claim physical draw order. Standard Laravel pagination metadata and links accompany `data`; an empty collection has an empty `data` array and zero total.
