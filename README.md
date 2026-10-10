# Lottery Stats

Lottery Stats is an application for exploring statistics from official Hungarian lottery drawings.

## Project Background

Lottery Stats builds on my earlier [React Lottery project](https://github.com/gaborcserto/lottery-react), with a stronger focus on exploring historical lottery results through statistics and interactive data visualizations.

The planned application will feature number frequency analysis, historical trends, and visual dashboards with charts and heatmaps, powered by a Laravel API and a React/TypeScript frontend.

## Applications

- `apps/api/` — Laravel 13.35.0 API using PHP 8.5.11, Composer 2.10.3, and SQLite
- `apps/web/` — Node.js 24.13.0, npm 11.21.0, React 19.3.0, TypeScript 7.0.2, Vite 8.3.4, React Router 8.4.0, and Sass 1.105.1

## Local development

Requirements: Docker Desktop running Linux containers and Docker Compose. From the repository root, start both development services:

```sh
docker compose up -d --build
```

On first startup, Compose builds the PHP 8.5.11 and Node.js 24.13.0 images, installs Composer and npm dependencies into named volumes, creates an ignored local `.env` with an application key, and creates the SQLite file if needed.

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

Laravel currently renders `/api/*` errors as JSON. Production debug must remain disabled to prevent internal details in those responses. Framework CORS defaults allow all origins without credentials, which is suitable for the planned public read-only API; review methods/origins if private or write endpoints are introduced. No lottery routes or importer are implemented yet.

The future importer must read environment-configured URLs through Laravel configuration and allowlist HTTPS on `bet.szerencsejatek.hu` with exactly `/cmsfiles/otos.json`, `/cmsfiles/hatos.json`, or `/cmsfiles/skandi.json`. Reject public URL input and disable redirects or validate each redirect destination. Enforce bounded connection/read timeouts, retries, and downloaded response bytes; validate JSON structure, numeric ranges, real dates, and historical drawing rules before transactional, idempotent SQLite writes. Remote failures must never delete historical data. Keep client errors and logs safe without raw payloads, secrets, or internal error details.

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

The Laravel foundation and minimal React application shell are implemented. Phase 3.10 establishes shared coding-agent guidance and development conventions. Lottery data, number analysis, historical trends, and chart or heatmap dashboards are planned and not implemented yet.

## Coding-agent guidance

[AGENTS.md](AGENTS.md) is the single source of truth for coding-agent instructions, including Laravel/React conventions, data integrity, security, and verification. Read it before changing files; this README remains the development setup reference. Optional workflows and a project-specific testing skill are deferred until recurring work needs more detailed procedures. The existing API Claude instruction file only references the shared guidance; no additional provider-specific setup is required.
