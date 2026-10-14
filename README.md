# Lottery Stats

Lottery Stats presents historical results and statistics for Hungary's official lottery games. A Laravel API serves data stored in SQLite, and a React frontend displays results and interactive statistics.

## Screenshots

- [Home – Light mode](docs/home.png)
- [Home – Dark mode](docs/home_dark.png)
- [Statistics](docs/subpage.png)
- [Mobile view](docs/mobile.png)

## Features

- Browse Ötöslottó, Hatoslottó, and Skandináv lottó results and drawing history.
- Explore number frequencies, parity, pairs, and yearly trends with charts and tables.
- Filter history by date, year, and week, and select numbers for yearly trends.
- Switch between light and dark themes.

## Tech stack

- Backend: Laravel 13, PHP 8.5, SQLite
- Frontend: React 19, TypeScript 6, React Router 8, Vite 8, Sass
- Development: Docker Compose

## Getting started

Start the local services from the repository root:

```sh
docker compose up -d --build
docker compose exec api php artisan migrate --seed
docker compose exec api php artisan lottery:sync
```

Open the frontend at <http://localhost:5173>. The API is available at <http://localhost:8000>; the frontend uses the Compose Vite proxy for API requests. Synchronization is manual by default.

## Development and testing

Run the main checks from the repository root with the Compose services running:

```sh
docker compose exec api composer test
docker compose exec web npm run test
docker compose exec web npm run lint
docker compose exec web npm run format:check
docker compose exec web npm run typecheck
```

See the [backend README](apps/api/README.md) for import and API details and the [frontend README](apps/web/README.md) for development, build, and hosting instructions.

## Data sources

The application imports the official JSON feeds published by Szerencsejáték Zrt.: [Ötöslottó](https://bet.szerencsejatek.hu/cmsfiles/otos.json), [Hatoslottó](https://bet.szerencsejatek.hu/cmsfiles/hatos.json), and [Skandináv lottó](https://bet.szerencsejatek.hu/cmsfiles/skandi.json). Import behavior and configuration are documented in the [backend README](apps/api/README.md#data-import).
