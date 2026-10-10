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
docker compose exec web npm run lint
docker compose exec web npm run format:check
docker compose exec web npm run typecheck
docker compose exec web npm run build
```

Frontend quality commands run from `apps/web/` (or through the Compose `web` service): `npm run lint` checks ESLint, `npm run lint:fix` applies ESLint fixes, `npm run format` formats frontend files with Prettier, `npm run format:check` verifies formatting, and `npm run typecheck` runs the TypeScript compiler. The existing `npm run build` also performs TypeScript verification before building with Vite.

SQLite lives at `apps/api/database/database.sqlite` on the host and remains in place across container restarts and `docker compose down`. The local database, `.env`, Composer dependencies, and npm dependencies are excluded from Git. Run `docker compose exec api php artisan migrate` to apply Laravel migrations. Docker Compose is for local development; production deployment is not configured.

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

The Laravel foundation and minimal React application shell are implemented. Lottery data, number analysis, historical trends, and chart or heatmap dashboards are planned and not implemented yet.
