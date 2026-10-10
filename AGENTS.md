# Engineering guidance

## Architecture

- Keep `apps/api/` (Laravel) and `apps/web/` (React with TypeScript and Vite) as separate applications; follow each framework's idioms.
- Keep controllers thin. Use Form Requests and API Resources where they clarify validation and response contracts.
- Use direct Eloquent queries for straightforward reads. Extract services when business logic or testing warrants them.
- Keep the REST API under `/api/v1` and keep OpenAPI documentation and frontend types aligned with actual API contracts.

## Code and correctness

- Write clear, natural code with concise names, focused functions, and straightforward control flow.
- Avoid speculative abstractions, unnecessary design patterns, redundant comments or PHPDoc, excessive logging, and artificial fragmentation.
- Validate remote JSON and external API input rigorously. Preserve historical drawing rules and data integrity.
- Keep imports transactional and idempotent. Never automatically delete historical drawing records.
- Use PHP types and strict TypeScript. Never fabricate data or expose secrets or internal errors.
- Do not introduce code generation before its workflow is established.

## Testing and workflow

- Keep GitHub Actions permissions minimal, pin actions to full commit SHAs, disable checkout credential persistence, and never execute untrusted pull requests with privileged tokens or secrets.
- Run lockfile audits with `npm audit --package-lock-only --include=dev` at the root and in `apps/web/`, and `docker compose exec api composer audit --locked --no-interaction`. Do not suppress advisories or upgrade dependencies as part of unrelated work.

- Add meaningful tests for new functionality; prefer focused tests during development and run full verification at phase completion.
- Avoid repetitive verification loops, arbitrary coverage targets, and tests written only to increase coverage.
- For backend changes, run Composer's `validate --strict`, `lint`, `analyse`, and `test` commands with `docker compose exec api composer`, then `git diff --check`. Use `lint:fix` for Laravel Pint formatting; keep PHPUnit and the Larastan level 6 checks.
- For frontend changes, run `test`, `lint`, `format:check`, `typecheck`, and `build` with `docker compose exec web npm run`; use `test:watch` for interactive test development and `lint:fix` and `format` to apply fixes. Keep TypeScript strict and use Prettier for frontend files.
- The repository pre-commit hook runs lint-staged for staged frontend files and formats staged PHP files with Pint through Docker Compose. Keep the hook limited to staged-file checks; do not add full test or build commands.
- GitHub Actions CI runs the existing Composer and frontend npm checks in separate jobs. Keep CI independent of Docker, production credentials, external data imports, and database services; PHPUnit uses the configured in-memory SQLite database.
- Make small, complete, reviewable changes. Avoid unrelated refactoring and placeholder implementations.
- Preserve `.references/` and existing work. Do not edit generated files manually or install unnecessary dependencies.
- Do not commit or push unless explicitly requested.

## Security

- Keep real environment files and secrets out of Git and logs. Treat `VITE_*` values as public. The committed `.env.testing` key is for tests only; production requires a unique `APP_KEY` and `APP_DEBUG=false`.
- Serve Laravel only from `apps/api/public/`. Keep SQLite and its journals outside public storage, with persistent storage and file access limited to the application user. Compose bind mounts and development servers are for local use only.
- For the future importer, read source URLs through Laravel configuration and allowlist the exact HTTPS host and paths for the three official JSON feeds. Never accept URLs from public input; disable redirects or validate every redirect destination to prevent SSRF.
- Bound connection/read timeouts, retries, and response bytes while downloading, then validate JSON structure, numeric ranges, dates, and historical drawing rules before transactional, idempotent writes. Remote failures must preserve historical records; return safe errors and avoid logging raw payloads or internal details.
