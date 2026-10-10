# Lottery Stats

Lottery Stats is a full-stack application for exploring statistics from official Hungarian lottery drawings.

## Project Background

Lottery Stats is planned as a modernized full-stack successor to the original [React-based lottery statistics application](https://github.com/gaborcserto/lottery-react). The new project will introduce a Laravel REST API, SQLite-based data management, and a modern React/TypeScript frontend. These components are planned and have not been implemented yet.

## Planned stack

- Laravel REST API with SQLite and Eloquent, documented with OpenAPI 3.1, Scramble, and Swagger UI
- React, strict TypeScript, Vite, and SCSS frontend, with Recharts and custom heatmaps planned for dashboards
- PHPUnit, Pint, PHPStan/Larastan, Vitest, React Testing Library, ESLint, and strict TypeScript
- GitHub Actions CI; local development with WSL2 and Docker Compose

## Repository layout

- `apps/api/` — Laravel API
- `apps/web/` — React frontend
- `.references/` — local reference material; ignored by Git

The lottery data source is Szerencsejáték Zrt. and its official lottery datasets.

## Status

Repository foundation is in progress. The applications have not been scaffolded yet; setup instructions will be added after scaffolding.
