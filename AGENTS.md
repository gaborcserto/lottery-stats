# Lottery Stats agent guidance

This is the single source of truth for stable coding-agent instructions. [README.md](README.md) covers project setup and commands. Optional workflows and a project-specific testing skill are deferred until recurring procedures warrant separate resources; load any future resources only when relevant.

For frontend code quality audits or targeted follow-up refactoring, use [frontend-code-quality](.agents/skills/frontend-code-quality/SKILL.md). Invoke it as `$frontend-code-quality`; agents without skill discovery can read the linked file directly. The skill supplies a review workflow; repository rules remain here.

The ignored `.notes/` directory contains optional local engineering notes and may be absent. Keep essential project decisions and instructions in tracked documentation; do not depend on `.notes/` files being present.

## Scope and workflow

- Before editing, check `git status` and the relevant diff; preserve unrelated work and `.references/`.
- Read the relevant implementation, callers, tests, and configuration. Search for reusable code and established conventions, then choose the smallest cohesive change.
- Verify actual paths, scripts, dependencies, and runtime assumptions. Do not invent APIs, environment variables, database fields, or library capabilities.
- Keep changes within the requested task and preserve behavior unless explicitly changing it. Avoid unrelated refactoring, placeholder implementations, unnecessary files, and dependencies.
- Use existing framework/library capabilities. Do not manually edit generated files or introduce code generation before its workflow is established.
- Review the final diff and run relevant checks. Report changed files, commands actually run, checks not run and why, and limitations or unfinished work. Stop at the requested phase.
- Never create branches, commit, or push without explicit permission. Never bypass hooks with `--no-verify`, force-push as a workaround, or bypass failed quality/security checks. When asked for a commit message, use a one-line Conventional Commit.

## Readability and structure

- Prefer clarity over cleverness, extreme brevity, or arbitrary function/file size limits. Use descriptive, consistent English names for internal code.
- Keep functions and components cohesive. Use clear control flow and early returns where helpful; avoid excessive nesting.
- Separate genuinely different responsibilities without fragmenting simple logic into tiny files, custom hooks, or wrapper functions. Extract shared logic when actual duplication warrants it.
- Avoid premature abstractions, speculative extensibility, generic boilerplate, excessive logging, and dead code. Comments and PHPDoc should explain non-obvious decisions or useful type information rather than narrate obvious behavior.

## Laravel and PHP

- Keep `apps/api/` (Laravel 13 / PHP 8.5) separate from `apps/web/` (React / TypeScript / Vite), following each framework's idioms. Use Docker Compose for local development; do not require host PHP or install Laravel Boost as agent setup.
- Use explicit parameter/property types and return declarations where practical. Use PHP 8.5 features when they improve readability and fit the configured runtime and dependencies.
- Keep controllers focused on HTTP responsibilities. Use Form Requests for meaningful validation and API Resources when response transformation clarifies the contract.
- Separate business logic from HTTP presentation. Prefer direct Eloquent/query builder queries when sufficient; extract services when business logic or testing warrants them, not for every action.
- Avoid generic repositories over Eloquent, unnecessary interfaces, container bindings, managers, and factories. Do not add CQRS, a Command Bus, or extra application layers without concrete requirements.
- Keep migrations, constraints, model relationships, and query scopes understandable. Use transactions for multi-record writes that must remain consistent.

## React and TypeScript

- Every reusable or substantial component, including page-specific components, has its own PascalCase directory with one primary named component and an `index.ts` public entry point. Import components through that directory; co-locate exclusive SCSS Modules, types, helpers and tests, keep private details private, and avoid circular or global component barrels. React Router convention route modules keep their required filenames.

- Preserve strict TypeScript and the existing ESLint configuration. Define explicit domain types, reuse API models/validation, and narrow `unknown` at untrusted boundaries; avoid `any`, unsafe casts, unnecessary non-null assertions, and type-check suppression.
- Use function components and idiomatic hooks. Separate API access, data transformation, and presentation; organize by feature when useful, following nearby patterns first.
- Avoid excessive custom hooks/component fragmentation, unnecessary effects or memoization, and duplicated state. Derive values from existing state when possible.
- Handle loading, error, empty, and success states explicitly. Never fabricate results or silently ignore failures.
- Use semantic HTML, accessible names/labels, keyboard interactions, and visible focus states. Check responsive behavior with a mobile-first approach.
- Use SCSS + CSS Modules for application styling; keep shared resets/theme styles global where appropriate. Support light, dark, and system themes and respect reduced-motion preferences when building UI.
- Do not introduce architecture/state management libraries or design systems without demonstrated need. React accesses the Laravel API, never the external lottery JSON feeds directly.

## Lottery data and API contracts

These are requirements for future implementation, not a reason to create a data model or API ahead of the requested phase.

- SQLite is the persistent source of truth. Validate and normalize external data before persistence; calculate statistics from normalized SQLite records.
- Use stable drawing identifiers grounded in source data and historical rules. Do not assume year/week alone is unique when multiple drawings can occur in a week.
- Keep imports transactional and idempotent. Preserve valid historical records on remote failures, invalid input, or incomplete feeds; never automatically delete historical drawings.
- Handle missing historical dates explicitly as missing, never as fabricated dates. Preserve historical rule changes instead of applying current rules to every drawing.
- Keep Hatos bonus numbers separate from main numbers and Scandinavian machine/manual sets distinct. Store drawing prizes at the drawing-record level, not on each number.
- Keep planned game identifiers consistent across configuration, database, and API. Official feed filenames do not by themselves define internal domain naming; verify agreed identifiers before implementation.
- State each statistical percentage denominator, including eligible drawings/sets and filters. Define empty-denominator behavior explicitly.
- Keep read-only REST endpoints under `/api/v1`. Validate query input and return consistent status/error contracts without internal details. Keep OpenAPI documentation and frontend types aligned with implemented contracts, reusing models rather than duplicating them.

## Security

- Treat external JSON, query parameters, and HTTP input as untrusted; validate at appropriate boundaries. Never silently swallow errors or expose secrets, credentials, tokens, database paths, stack traces, raw payloads, or internal errors to clients/logs.
- Keep real environment files and secrets outside Git. Treat `VITE_*` values as public. The committed `.env.testing` key is for tests only; production requires a unique secret `APP_KEY` and `APP_DEBUG=false`.
- Serve Laravel only from `apps/api/public/`. Keep SQLite and its journals outside public storage, with persistent storage and access limited to the application user. Compose bind mounts and development servers are for local use only.
- Read future source URLs through Laravel configuration backed by environment variables. Allowlist HTTPS on `bet.szerencsejatek.hu` with exactly `/cmsfiles/otos.json`, `/cmsfiles/hatos.json`, and `/cmsfiles/skandi.json`. Never accept public URL input; disable redirects or validate every redirect destination to prevent SSRF.
- Bound connection/read timeouts, retries, and downloaded bytes. Validate JSON structure, numeric ranges, real dates when present, and historical drawing rules before transactional writes; remote failures must preserve records.
- Keep GitHub Actions permissions minimal, pin actions to full commit SHAs, disable checkout credential persistence, and never execute untrusted pull requests with privileged tokens or secrets.
- Do not introduce authentication/authorization infrastructure for the public read-only API without a concrete requirement.

## Testing and verification

- Add focused tests alongside behavioral changes and regression tests for confirmed bugs. Assert meaningful behavior and boundaries with small deterministic fixtures; avoid implementation coupling, placeholder tests, speculative mocks, and arbitrary coverage targets. Never weaken tests to pass checks.
- PHPUnit Unit tests cover pure logic; Feature tests cover Laravel HTTP/database behavior. Use `RefreshDatabase` when migrated tables are needed. Preserve forced in-memory SQLite isolation; tests must never use development/production databases or live lottery feeds. Composer's `test` script clears cached configuration before PHPUnit.
- Never run destructive database commands unless the effective database connection and target have been explicitly verified as disposable. `--env=testing` alone does not guarantee database isolation. Destructive commands include `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, and custom commands that drop or truncate tables. Use the isolated `MigrationSafetyTest` for migration and rollback verification.
- Use Vitest and React Testing Library for frontend behavior with the existing jsdom setup; prefer accessible user-visible assertions. Frontend tests must not require Laravel or external feeds.
- During implementation, run the narrowest relevant checks. At phase completion, run full verification for affected applications; do not repeat unchanged full-project checks without new changes, failures, or unresolved concerns. Documentation-only work needs content/reference validation and `git diff --check`, not application test suites.
- Run commands below from the repository root with relevant Compose services running. Backend checks: `docker compose exec api composer validate --strict`, then Composer `lint`, `analyse`, and `test` with the same prefix. Use `lint:fix` for Pint formatting; preserve PHPUnit and Larastan level 6.
- Frontend checks: `docker compose exec web npm run test`, then `lint`, `format:check`, `typecheck`, and `build` with the same prefix. Use `test:watch` for interactive development and `lint:fix`/`format` to apply fixes. Keep Prettier formatting.
- For dependency/security work, run `npm audit --package-lock-only --include=dev` at the root and in `apps/web/` (or `docker compose exec web npm audit --package-lock-only --include=dev`), plus `docker compose exec api composer audit --locked --no-interaction`. Do not suppress advisories or upgrade dependencies during unrelated work.
- Preserve Husky/lint-staged behavior: check staged frontend files and format staged PHP with Pint through Docker Compose. Do not add full tests/builds to the hook.
- Preserve independent backend/frontend CI jobs using existing checks. CI must remain independent of Docker, production credentials, external imports, and database services.
- Finish with `git diff --check`. Do not claim a check passed without running it; report failed or unexecuted checks honestly.
