# Backend

The backend is a Laravel 13 JSON API. It stores normalized lottery drawings and statistics in SQLite and provides server-side commands for importing official source data.

For the initial Docker Compose setup, see the root [Getting started](../../README.md#getting-started) instructions.

## Data import

The persistent SQLite database is `database/database.sqlite`. Initialize it with the root Getting started sequence before importing data.

The `lottery:sync` Artisan command retrieves and validates a game's official JSON feed, then persists each batch transactionally. It is idempotent, preserves existing history when a feed fails or omits records, and skips recently synchronized games by default.

The importer keeps missing historical dates unknown and preserves source year/week values. Dated drawings use their source date for identity; undated drawings include their normalized number sets in the identity because a game can have multiple drawings in one week. Hatoslottó bonus numbers and Skandináv lottó machine/manual sets remain separate records.

```sh
docker compose exec api php artisan lottery:sync
docker compose exec api php artisan lottery:sync five
docker compose exec api php artisan lottery:sync five --force
docker compose exec api php artisan lottery:sync --status
```

Supported game codes are `five`, `six`, and `scandinavian`. `--force` bypasses the freshness check; `--status` reports synchronization state without fetching data. Synchronization is manual by default. To enable the optional local Compose `lottery-sync` service, set `LOTTERY_AUTO_SYNC=true` in `apps/api/.env` before starting the services. It runs once at startup and considers data fresh for 24 hours by default; restart it after changing configuration with `docker compose up -d lottery-sync`.

`config/lottery.php` reads these environment variables from `apps/api/.env`:

- `LOTTERY_FIVE_URL`, `LOTTERY_SIX_URL`, `LOTTERY_SCANDINAVIAN_URL`: source URLs, defaulting to the official feeds listed in the root README. Requests are restricted to the official HTTPS host and matching game paths.
- `LOTTERY_SYNC_INTERVAL_HOURS`: freshness interval (default `24`).
- `LOTTERY_CONNECT_TIMEOUT_SECONDS`, `LOTTERY_REQUEST_TIMEOUT_SECONDS`, `LOTTERY_RETRY_ATTEMPTS`, `LOTTERY_RETRY_DELAY_MILLISECONDS`, `LOTTERY_MAX_RESPONSE_BYTES`: request bounds (defaults `5`, `30`, `3`, `250`, and `16777216`).
- `LOTTERY_SYNC_LOCK_SECONDS` and `LOTTERY_STARTUP_SCHEMA_WAIT_SECONDS`: per-game lock lifetime and optional startup schema wait (defaults `900` and `120`).

Redirects are disabled. Invalid or unavailable feeds do not remove persisted drawings or advance the last successful synchronization time.

## REST API and OpenAPI

Read-only JSON endpoints use `/api/v1`:

| Endpoint | Purpose |
| --- | --- |
| `GET /games` and `GET /games/{game}` | List supported games or get one game. |
| `GET /games/{game}/drawings` | Paginated drawing summaries; `include=details` includes number sets and prizes. |
| `GET /games/{game}/drawings/latest` and `GET /games/{game}/drawings/{id}` | Get the latest drawing or one drawing. |
| `GET /games/{game}/statistics/{metric}` | Get summary, frequencies, parity, or pairs. |
| `GET /games/{game}/statistics/trends/yearly` | Get yearly statistics, optionally for one number. |

Statistics accept population filters `year`, `week`, `from_date`, `to_date`, and `set`. Frequency sorting and limits, drawing pagination, and other parameter details are defined in the [OpenAPI specification](resources/openapi.json). Frequency, pair, and set-distribution percentages use eligible sets as their denominator; parity occurrence shares use all eligible number occurrences. Scandinavian `set=combined` counts machine and manual sets independently; Hatoslottó bonus numbers are excluded from statistics.

In local development, Swagger UI is at <http://localhost:8000/api-docs> and the served specification is at <http://localhost:8000/api-docs/openapi.json>. `API_DOCS_ENABLED` defaults to true only when `APP_ENV=local`; it is disabled by default in production and tests.

## Development and verification

Run backend commands from the repository root while the Compose `api` service is running:

```sh
docker compose exec api composer validate --strict
docker compose exec api composer lint
docker compose exec api composer analyse
docker compose exec api composer test
```

These run Composer validation, Laravel Pint, Larastan, and PHPUnit. The test suite uses isolated in-memory SQLite. See the shared [AGENTS.md](../../AGENTS.md) for repository-wide implementation and database-safety requirements.
