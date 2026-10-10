# Lottery Stats

Lottery Stats is an application for exploring statistics from official Hungarian lottery drawings.

## Project Background

Lottery Stats builds on my earlier [React Lottery project](https://github.com/gaborcserto/lottery-react), with a stronger focus on exploring historical lottery results through statistics and interactive data visualizations.

The planned application will feature number frequency analysis, historical trends, and visual dashboards with charts and heatmaps, powered by a Laravel API and a React/TypeScript frontend.

## Lottery data integrity

Drawing identity uses `date:YYYY-MM-DD` when the source supplies a date. Undated drawings use source year/week plus a hash of their labeled normalized number sets; year/week alone is not unique. Corrected numbers on an undated drawing or a newly supplied date can change its identity. Without an authoritative source ID, the importer preserves the old row and does not guess a match. Missing historical dates stay null, and source year/week are retained without forcing ISO-week agreement.

SQLite is the persistent source of truth. Import each game's validated batch in one transaction, update changed children under the existing drawing identity, and preserve historical rows missing from a later feed. Keep Hatos bonus numbers and Scandinavian machine/manual sets distinct. Store prize amounts as decimal strings without floating-point conversion; unknown values stay null. Complete historical all-zero Five and Six prize vectors remain unknown until their meaning is confirmed. Current normalized HUF amounts are whole units; review SQLite fixed-point storage before accepting fractional amounts.

Persistence success does not mean a remote source synchronized successfully. Update import-state timestamps only after retrieval, validation, and persistence all succeed. SQLite serializes writers database-wide; persistence must acquire the write lock before comparison reads, and synchronization must separately prevent overlapping remote runs. The ignored `.notes/` directory may contain detailed working notes, but these tracked decisions stand on their own.

## Applications

- `apps/api/` — Laravel 13.35.0 API using PHP 8.5.11, Composer 2.10.3, and SQLite
- `apps/web/` — Node.js 24.13.0, npm 11.21.0, React 19.3.0, TypeScript 7.0.2, Vite 8.3.4, React Router 8.4.0, and Sass 1.105.1

## Local development

Requirements: Docker Desktop running Linux containers and Docker Compose. From the repository root, start both development services:

```sh
docker compose up -d --build
```

On first startup, Compose builds the PHP 8.5.11 and Node.js 24.13.0 images, installs Composer and npm dependencies into named volumes, creates an ignored local `.env` with an application key, and creates the SQLite file if needed.

Initialize a new database with the non-destructive migrations and seed the stable game rows:

```sh
docker compose exec api php artisan migrate --seed
```

Lottery synchronization is manual by default. Set `LOTTERY_AUTO_SYNC=true` in `apps/api/.env` before starting Compose to enable the separate one-shot `lottery-sync` service in local development. It waits up to two minutes for the schema, then imports games with missing data or a last successful synchronization at least 24 hours old. The API and Vite remain available while it runs, and a network failure leaves cached SQLite drawings usable. The startup process exits immediately in tests and outside the `local` environment. Set the toggle to `false` to disable it; restart the one-shot service with `docker compose up -d lottery-sync` after changing the setting.

Manual synchronization uses the same freshness and safety rules:

```sh
docker compose exec api php artisan lottery:sync
docker compose exec api php artisan lottery:sync five
docker compose exec api php artisan lottery:sync five --force
docker compose exec api php artisan lottery:sync --status
```

The command syncs all games by default, accepts `five`, `six`, or `scandinavian`, skips fresh data without a request, and reports drawing counts per game. `--force` bypasses freshness. `--status` displays each game's last attempt, last success, and current state without fetching. Failed retrieval, validation, or persistence records a concise failure while preserving the prior success timestamp and all existing drawings.

- Laravel: <http://localhost:8000>
- React/Vite: <http://localhost:5173>

Use `docker compose logs -f` to follow service logs and `docker compose down` to stop the development environment. The frontend can call `/api`; Vite proxies those requests to the Laravel `api` service. No lottery API routes are implemented yet, so `/api` currently returns Laravel's 404 response.

Useful checks from the repository root:

```sh
docker compose exec api php artisan --version
docker compose exec api php artisan migrate:status
docker compose exec api composer test
docker compose exec web npm run test
docker compose exec web npm run lint
docker compose exec web npm run format:check
docker compose exec web npm run typecheck
docker compose exec web npm run build
```

Frontend quality commands run from `apps/web/` (or through the Compose `web` service): `npm run test` runs Vitest once, `npm run test:watch` starts its interactive watch mode, `npm run lint` checks ESLint, `npm run lint:fix` applies ESLint fixes, `npm run format` formats frontend files with Prettier, `npm run format:check` verifies formatting, and `npm run typecheck` runs the TypeScript compiler. The existing `npm run build` also performs TypeScript verification before building with Vite. The tests use jsdom and React Testing Library and do not require Laravel or the development database.

## Git pre-commit checks

Git hooks require Git, Node.js/npm on the host, Docker Compose, and the `web` and `api` services running. From the repository root, run `npm install` once to install Husky and lint-staged and activate the hook. Each commit then checks only staged frontend files with ESLint and Prettier, and formats staged PHP files with Laravel Pint in the `api` container. Frontend dependencies can remain in the Compose `web` service; PHP dependencies are provided by the `api` service. Run the same frontend checks manually with `docker compose exec web npm run lint` and `docker compose exec web npm run format:check`, and format PHP manually with `docker compose exec api composer lint:fix` or check it with `docker compose exec api composer lint`.

## Continuous integration

The GitHub Actions workflow runs independent backend and frontend jobs on pushes and pull requests targeting `main`, and on manual dispatch. The backend job installs the locked Composer dependencies and runs strict validation, Pint, Larastan, and PHPUnit with in-memory SQLite. The frontend job installs the locked npm dependencies and runs ESLint, Prettier, TypeScript, Vitest, and the production build. Run the same checks locally with the Composer and frontend commands above; CI does not require Docker or a production database.

SQLite lives at `apps/api/database/database.sqlite` on the host and remains in place across container restarts and `docker compose down`. The local database, `.env`, Composer dependencies, and npm dependencies are excluded from Git. Run `docker compose exec api php artisan migrate` to apply Laravel migrations. Docker Compose is for local development; production deployment is not configured.

## Security baseline

Dependency audits run in a separate GitHub Actions workflow on pushes and pull requests targeting `main`, weekly on Monday at 05:17 UTC, and on manual dispatch. They audit the root/frontend npm lockfiles and Composer lockfile, including development dependencies, without installing application dependencies. Any reported vulnerability fails the check; handle dependency updates separately rather than suppressing advisories.

```sh
npm audit --package-lock-only --include=dev
docker compose exec web npm audit --package-lock-only --include=dev
docker compose exec api composer audit --locked --no-interaction
```

CodeQL supports this public repository's JavaScript/TypeScript and React code, but not PHP. The prepared `.github/codeql.yml` configuration is intentionally outside the Actions workflow directory: GitHub returned HTTP 401 when checking default setup. Before moving it to `.github/workflows/codeql.yml`, confirm in Settings > Advanced Security > Code scanning that default setup is disabled and no other CodeQL scan exists. If default setup is already enabled, retain it instead. The prepared workflow uses pinned CodeQL v4 actions, no dependency installation or build, push/PR scans targeting `main`, a weekly Monday 03:43 UTC scan, and job-scoped `security-events: write`. Upload failures must be resolved in repository settings without granting broader permissions.

Compose publishes development ports only on host loopback. Its root containers, bind mounts, development servers, and local `APP_DEBUG=true` template are not a production deployment. Production must set `APP_ENV=production`, `APP_DEBUG=false`, and a unique secret `APP_KEY`; serve only `apps/api/public/`, and keep the persistent SQLite database and journals outside public storage with access restricted to the application user. Windows bind-mount permissions require host access controls rather than relying on container `chmod`. The committed `.env.testing` key is only a test fixture. Never put secrets in `VITE_*` variables or logs.

Laravel currently renders `/api/*` errors as JSON. Production debug must remain disabled to prevent internal details in those responses. Framework CORS defaults allow all origins without credentials, which is suitable for the planned public read-only API; review methods/origins if private or write endpoints are introduced. No lottery API routes are implemented yet.

The importer reads environment-configured URLs through Laravel configuration and allows HTTPS on `bet.szerencsejatek.hu` only for `/cmsfiles/otos.json`, `/cmsfiles/hatos.json`, and `/cmsfiles/skandi.json`. Redirects are disabled. Connection/request timeouts, bounded retries, and a 16 MiB response limit protect retrieval before strict normalization and transactional persistence. Remote failures never delete historical data, and errors omit response bodies and configured URLs.

## PHP quality checks

Run backend checks from the repository root with the `api` service running:

```sh
docker compose exec api composer validate --strict
docker compose exec api composer lint     # Check Laravel Pint formatting
docker compose exec api composer lint:fix # Apply Laravel Pint formatting
docker compose exec api composer analyse  # Run Larastan / PHPStan
docker compose exec api composer test     # Run PHPUnit unit and feature tests
```

Pint uses its default Laravel preset. Larastan runs at level 6 over application code, bootstrap entry points, configuration, database code, and routes; dependencies and generated caches are outside the analysis paths. PHPUnit retains the existing in-memory SQLite test configuration. Composer scripts also work directly from `apps/api/` when PHP and dependencies are available.

Backend tests live in `apps/api/tests/Unit` and `apps/api/tests/Feature`. Keep Unit tests focused on pure logic; use Feature tests for Laravel behavior and database access. Use Laravel's `RefreshDatabase` trait for tests that need migrated tables. Run tests with `docker compose exec api composer test`, which clears cached Laravel configuration before PHPUnit starts.

Before completing backend changes, run validation, `lint`, `analyse`, `test`, and `git diff --check`. Use `lint:fix` when formatting needs correction.

## Status

The Laravel backend can normalize, persist, and synchronize official lottery drawings through the manual command and optional local startup process. Read-only lottery API routes, number analysis, historical trends, and chart or heatmap dashboards remain planned.

## Coding-agent guidance

[AGENTS.md](AGENTS.md) is the single source of truth for coding-agent instructions, including Laravel/React conventions, data integrity, security, and verification. Read it before changing files; this README remains the development setup reference. Optional workflows and a project-specific testing skill are deferred until recurring work needs more detailed procedures. The existing API Claude instruction file only references the shared guidance; no additional provider-specific setup is required.
