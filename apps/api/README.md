# Lottery Stats API

This application provides the Laravel 13 / PHP 8.5 backend and read-only results and statistics APIs, backed by SQLite. Official drawings can be synchronized through Artisan.

See the [project README](../../README.md) for Docker Compose setup, backend quality commands, testing, and security requirements. Coding agents should follow the shared [AGENTS.md](../../AGENTS.md).

## Database safety

The persistent development database is `database/database.sqlite`, selected by the local `.env`. PHPUnit uses isolated SQLite `:memory:` settings from `phpunit.xml`; `.env.testing` also explicitly selects `:memory:` for Artisan commands. A disposable migration-verification database exists only inside the isolated PHPUnit process. A database file's SHA-256 compares bytes, not logical application data; routine session or other database writes can change it while lottery records remain unchanged. Prefer read-only integrity, foreign-key, drawing-count, source-identity, and import-metadata checks. When exact application-data equivalence is needed, compare logically ordered content. Do not alter or repair the database to restore an earlier file hash.

Verify migrations and rollback with `docker compose exec api composer test -- --filter=MigrationSafetyTest`. The test checks the effective driver, database target, and URL before running `migrate:fresh` and `migrate:rollback`, then reapplies migrations on the same in-memory connection. Never run destructive commands unless you have explicitly verified that the effective connection and target are disposable. `--env=testing` alone does not guarantee isolation. Treat `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `migrate:rollback`, `db:wipe`, and any table-drop or truncation command as destructive. Never use them against the persistent development database for verification.

## Lottery data sources

`config/lottery.php` maps the stable game codes `five`, `six`, and `scandinavian` to their official JSON source URLs. Set `LOTTERY_FIVE_URL`, `LOTTERY_SIX_URL`, or `LOTTERY_SCANDINAVIAN_URL` in the environment to override a game's source independently; runtime validation still requires the exact official HTTPS host and game path.

Run `php artisan lottery:sync` for all games, add a game code for one game, or add `--force` to bypass the configured 24-hour freshness interval. `php artisan lottery:sync --status` shows per-game timestamps and state without fetching. A failed fetch, invalid feed, or persistence error keeps existing historical records and the previous successful timestamp.

Local Docker startup synchronization is off by default. Set `LOTTERY_AUTO_SYNC=true` to enable the separate one-shot Compose service; `LOTTERY_SYNC_INTERVAL_HOURS` changes the freshness interval. It runs only in the `local` environment, never during PHPUnit, and does not block the API or Vite. It waits for the schema but never runs migrations. On a new checkout, run `docker compose exec api php artisan migrate --seed`; if the one-shot process timed out first, restart it with `docker compose up -d lottery-sync`.

Essential source identity, historical-data, prize-precision, and import-safety decisions are summarized in the [project README](../../README.md#lottery-data-integrity). Optional detailed engineering notes may exist in the ignored root `.notes/` directory.

## API security and deployment

The API is intentionally public and read-only: no login, API tokens, JWT, Sanctum, or credentialed browser requests. Its ten routes accept GET and Laravel's automatic HEAD; no import, synchronization, migration, or administration route exists. Import commands remain server-side Artisan operations. CORS is browser policy, not access control.

Laravel's named `public-api` limiter shares a quota of **60 requests per minute per client IP** across the API routes. `API_RATE_LIMIT_PER_MINUTE` configures the quota (minimum effective value 1). Successful requests expose `X-RateLimit-Limit` and `X-RateLimit-Remaining`; exceeded quotas return JSON `429` with `Retry-After` in seconds and `X-RateLimit-Reset` as a Unix timestamp. Preflights, unmatched routes, health checks, and documentation do not consume this route-level quota. Tests use a forced array limiter store, rebuilt for each test application, independently of local counters.

`API_RATE_LIMIT_STORE=file` is the default. Counters live in Laravel's existing private filesystem cache rather than the lottery SQLite database; no Redis, extra service, or migration is required. Ensure application-owned cache storage is writable and persistent. File counters are suitable for this single-instance setup; they do not coordinate multiple hosts and are not a hard concurrency guarantee. A deployment with multiple instances needs a shared supported cache store and/or an upstream request limit. All users behind one untrusted proxy or NAT share its visible IP quota.

Prefer relative `/api/v1/...` requests through Vite's existing `/api` proxy at `http://localhost:5173`. `CORS_ALLOWED_ORIGINS` defaults to empty, which permits no cross-origin browser access. For direct calls to `http://localhost:8000`, set `CORS_ALLOWED_ORIGINS=http://localhost:5173`. Production can supply a comma-separated list of exact frontend origins, including schemes and ports and without trailing slashes. Do not use `*`. Laravel's built-in CORS middleware handles OPTIONS, permits GET/HEAD/OPTIONS and Accept/Content-Type, exposes quota headers, and disables credentials. With a single configured origin the CORS library can emit that fixed origin even to disallowed requests; the browser rejects the origin mismatch. With multiple origins it emits only a matching allowed origin.

`TRUSTED_PROXIES` defaults to an explicit empty list. Forwarding headers from arbitrary peers do not change rate-limit identity. Behind a reverse proxy, configure only its known IPs or CIDRs, restrict direct access to the application, and have the proxy replace untrusted incoming forwarding headers. Never configure `*`, `**`, or `REMOTE_ADDR`. Only X-Forwarded-For and X-Forwarded-Proto are trusted for configured peers; forwarded host/port/prefix are not trusted. The development Vite proxy is not trusted automatically, so proxied clients share its IP quota.

API responses, including preflights and JSON errors, receive `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store, private`. No-store prevents stale statistics and reuse of another client's quota/error response. JSON endpoints do not need an HTML-oriented CSP. Configure TLS and HSTS at the production HTTPS edge; local HTTP does not enable HSTS.

Production must use a unique secret `APP_KEY`, `APP_ENV=production`, and **`APP_DEBUG=false`**. Laravel retains its normal exception handling: validation gives JSON `422`, throttling gives JSON `429`, and production server failures return only `{"message":"Server Error"}`. A targeted API 404 renderer returns `{"message":"Not Found"}` so Eloquent model names do not leak. Development server failures retain debug diagnostics. Keep development servers off public networks and protect server logs, environment files, private cache storage, and SQLite files; serve only `public/`. Compose remains local development infrastructure. After changing deployment environment values, rebuild Laravel's configuration cache as appropriate; documentation routes check configuration at request time, including when routes are cached.

## OpenAPI and Swagger UI

- Swagger UI: [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
- Served specification: [http://localhost:8000/api-docs/openapi.json](http://localhost:8000/api-docs/openapi.json)
- Single tracked specification: [resources/openapi.json](resources/openapi.json), OpenAPI 3.0.3.

`API_DOCS_ENABLED` defaults to true only for `APP_ENV=local`; it is false by default in production and testing. PHPUnit explicitly enables it for availability tests. Set `API_DOCS_ENABLED=false` to disable both routes, or enable them explicitly in a restricted developer deployment. Routes bypass the session-bearing web middleware and perform no database queries, synchronization, or lottery data writes.

Tooling comparison: [Scramble](https://github.com/dedoc/scramble/blob/main/composer.json) is maintained and its current requirements support PHP 8.5 and Laravel 13, with parser and package-tool dependencies. Generation would still need explicit descriptions/schemas for the dynamic statistics contracts. A manual OpenAPI YAML document with lightweight [Swagger UI](https://swagger.io/docs/open-source-tools/swagger-ui/usage/installation/) avoids those runtime dependencies but needs a YAML parser for PHP checks. This project chooses the same manual strategy in JSON, an equivalent OpenAPI serialization that PHP parses natively. There are **no added Composer or npm dependencies** and no generated specification or PHP annotations.

The standard Swagger UI distribution is pinned to 5.33.1 on jsDelivr with explicit versioned asset URLs. It has no theme customization or authentication controls, permits GET execution against the same-origin API, does not enable cross-origin credentials, and disables the external Swagger validator. The assets omit Subresource Integrity because its integrity attributes prevented loading in the IDE browser; this reduces protection against CDN asset tampering. **The UI requires browser internet access to the CDN**; the local specification and API remain available without it. A deployment requiring offline assets or Subresource Integrity should serve reviewed Swagger distribution files locally instead. UI asset requests contact the CDN; API/schema requests stay on the local origin.

All five results and five statistics operations document actual query parameters, bounds, defaults, response schemas, nullable history, filters, pagination, number sets, prize tiers, examples, error responses, and quota headers. Statistics descriptions include eligible-set denominators, parity occurrence shares, combined Scandinavian scope, Six bonus exclusion, frequency and pair tie-breakers, yearly selected-number behavior, empty populations, and historical completeness. Unused query parameters on game/detail/latest endpoints are ignored by the existing implementation; lists and statistics reject unsupported parameters.

Keep the specification aligned when changing API resources or request validation. `OpenApiTest` checks the complete route surface, query names/limits/enums/date formats against validation, and representative serialized response schemas across all games. `ApiSecurityTest` checks anonymous access, quota expiry and client isolation, proxy trust, CORS and preflight, headers, JSON errors, production error redaction, and read-only routes. The schema assertions cover the keywords used by representative responses; they are not a general OpenAPI validator. Full structural validation can be run with the pinned, ephemeral Redocly CLI below, without modifying lockfiles (requires Node/npm and registry access).

Run from the repository root with the API service running:

```sh
docker compose config --quiet
docker compose exec api composer validate --strict
docker compose exec api composer lint
docker compose exec api composer analyse
docker compose exec api composer test
# Narrow security/contract checks during implementation:
docker compose exec api composer test -- --filter='ApiSecurityTest|OpenApiTest'
npx --yes @redocly/cli@2.62.1 lint apps/api/resources/openapi.json --extends minimal
git diff --check
```

For read-only local smoke checks, open Swagger and confirm its ten operations render; execute a representative GET, inspect the schema, quota/security headers, a missing drawing, and an invalid query. Do not intentionally exhaust shared local quotas or run synchronization. Production-safe 500 behavior belongs in isolated Feature tests, not a public diagnostic route.

## Results API (`/api/v1`)

All endpoints return JSON. Game codes are `five`, `six`, and `scandinavian`; game resources expose only `code` and the stored Hungarian `name`. Drawing detail uses the numeric database drawing ID, scoped to its game.

| Method and path | Response |
| --- | --- |
| `GET /games` | `data` array of supported games |
| `GET /games/{game}` | One game in `data` |
| `GET /games/{game}/drawings` | Paginated drawing summaries; `include=details` adds sets and prizes |
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

Use `include=details` on the drawings list for complete drawing records in one paginated request. It preserves the detail endpoint's set ordering, missing dates, and exact nullable prize strings; the default remains summaries. Relations are eager-loaded only for the requested page.

The drawings list accepts `include` (only `details`), `page` (default `1`), `per_page` (default `20`, maximum `100`), `year` (1–9999), `week` (1–53), `from_date`, and `to_date` (both `YYYY-MM-DD`, inclusive). Year/week filters include undated records. Date filters exclude records with a null date. Malformed values and reversed date ranges return `422` with Laravel's JSON validation errors. Unknown game codes and missing or cross-game drawing IDs return JSON `404`.

List and latest use the same descending source ordering: year, then week, with dated records ahead of undated records within a week, then date and numeric ID descending for stable ties. The ID tie-breaker does not claim physical draw order. Standard Laravel pagination metadata and links accompany `data`; an empty collection has an empty `data` array and zero total.

## Statistics API (`/api/v1`)

All five endpoints are read-only GET requests. Responses contain `data` and a common `meta` object with `game`, `filters`, `set_scope`, `drawing_count`, `eligible_set_count`, and `percentage_precision` (2). `filters` is an object, including `{}` when no population filters apply; year and week are integers. Set scope and endpoint options are represented separately in metadata.

| Path after `/games/{game}/statistics/` | Data | Additional parameters |
| --- | --- | --- |
| `summary` | Drawing/set counts, `min_year`, `max_year`, `from_date`, `to_date`, `undated_drawing_count` | None |
| `frequencies` | Array of `number`, `count`, `occurrence_percentage` | `sort=number\|most\|least`, `limit` (1-90) |
| `parity` | `number_occurrence_count`, `even`, `odd`, and `distribution` | None |
| `pairs` | Array of `first_number`, `second_number`, `count`, `occurrence_percentage` | `limit` (default 20, 1-100) |
| `trends/yearly` | Array of `year`, `drawing_count`, `eligible_set_count`, `number_occurrence_count` | Optional `number` in the game's range |

Every endpoint accepts `year` (1-9999), `week` (1-53), `from_date`, `to_date`, and `set`. Dates must be real `YYYY-MM-DD` dates; bounds are inclusive and `to_date` cannot precede `from_date`. All supplied filters are intersected in SQL. Year/week refer to source fields and include undated drawings; either date bound excludes undated drawings. Unknown parameters, malformed values, and inappropriate options return JSON `422` with `message` and field-keyed `errors`. Unknown games return JSON `404`, including when their query parameters are invalid.

### Population and mathematical definitions

Five has numbers 1-90 and uses only `main` (five distinct numbers per set). Six has numbers 1-45 and uses only `main` (six distinct numbers per set); historical `bonus` sets are excluded from every statistic. Both default to `set=main`, the only accepted scope. Scandinavian has numbers 1-35 and seven distinct numbers per set. It defaults to `set=machine`; `set=manual` and explicitly requested `set=combined` are also supported. Combined selects the persisted `machine` and `manual` sets independently, never deduplicating their overlaps or pairing numbers across sets.

Matching drawing count is the count of drawing records satisfying the population filters, independent of set selection. Eligible set count is the count of actual persisted sets of the selected types within those drawings, not an assumed multiplier of the drawing count. With complete normalized data it equals drawing count for Five/Six or one Scandinavian scope, and twice drawing count for combined Scandinavian. A drawing lacking a selected set still contributes to drawing count, source years, and date coverage, but contributes no eligible set or number occurrence.

Number frequency `count` is the number of eligible sets containing that number. Number `occurrence_percentage = count / eligible_set_count * 100`. Set uniqueness ensures at most one occurrence of a number per set. This also means drawing occurrence percentage for Five/Six and individual Scandinavian scopes when every drawing has its expected set. Combined Scandinavian remains set-based: a number in both sets of one drawing contributes twice to its count and there are two denominator units. This percentage is never divided by all selected balls, and percentages across all numbers need not sum to 100.

Frequencies include zero-count numbers across the full game range by default, ordered numerically ascending. `sort=most` orders count descending; `sort=least` orders count ascending and includes zeros. Both break ties by number ascending and default to 10 results. Explicit `limit` overrides the default; results cannot exceed the game's number range. The numeric sort defaults to the full range. Ranking metadata includes the effective `sort` and requested/default `limit`; limit is a cap, so fewer rows may be returned.

Parity counts every eligible number occurrence, including repeated appearances across sets. `even` and `odd` each contain `count` and `occurrence_share_percentage = count / number_occurrence_count * 100`; this is an occurrence share, not a drawing percentage. `distribution` groups eligible sets by `even_count` and `odd_count`, returning their `eligible_set_count` and `set_percentage = group_set_count / total_eligible_set_count * 100`. Groups sort by even count, then odd count ascending. The response names both denominators explicitly.

Pairs are unordered, with `first_number < second_number`. Each pair contributes once per eligible set containing both numbers. The SQL self-join requires the same set ID, so combined Scandinavian aggregates the two sets' pair occurrences independently. Pair `occurrence_percentage = pair_count / eligible_set_count * 100`. Results include only observed pairs, ordered by count descending, then first and second number ascending; metadata identifies the denominator and limit. A normalized set with k numbers contributes k * (k - 1) / 2 total pairs.

Yearly trends group by source year ascending, including undated historical records. Each row counts distinct drawings, actual eligible sets, and their number occurrences. Optional `number` adds `selected_number_count` and `selected_number_occurrence_percentage`, using that row's eligible set count as denominator. It does not narrow the population or its ball count. Metadata echoes `selected_number` (null when absent) and names `yearly_eligible_set_count` as the percentage denominator.

All percentages are JSON numbers rounded half-up to two decimal places (trailing zeros are not significant). A zero denominator returns 0, never null or a division error. Empty summaries have zero counts and null year/date bounds. Empty frequencies retain the game's complete range with zeros, while pairs, parity distribution, and yearly trends return empty arrays. Date coverage describes only known dates and never fabricates missing ones; year coverage is based on source year.

Example requests:

```text
/api/v1/games/five/statistics/summary?year=2025
/api/v1/games/five/statistics/frequencies?sort=most&limit=10
/api/v1/games/six/statistics/frequencies?week=10
/api/v1/games/scandinavian/statistics/frequencies?set=machine
/api/v1/games/scandinavian/statistics/frequencies?set=manual&sort=least&limit=5
/api/v1/games/scandinavian/statistics/parity?set=combined
/api/v1/games/scandinavian/statistics/pairs?set=combined&limit=20
/api/v1/games/five/statistics/trends/yearly?number=7&from_date=2020-01-01&to_date=2025-12-31
```

For example, one number occurring in three of four combined Scandinavian sets is represented as:

```json
{
  "data": [{"number": 1, "count": 3, "occurrence_percentage": 75}],
  "meta": {
    "game": "scandinavian", "filters": {}, "set_scope": "combined",
    "drawing_count": 2, "eligible_set_count": 4, "percentage_precision": 2,
    "occurrence_percentage_denominator": "eligible_set_count", "sort": "number", "limit": 1
  }
}
```

### Query architecture and historical limitations

`LotteryStatistics` keeps calculation independent of HTTP. `StatisticsRequest` validates endpoint-specific options and `DrawingFilters` shares population rules and SQL predicates with the results API. A SQLite read transaction holds one snapshot across each response's denominator and metric queries. Summary uses two SELECTs including game lookup; other endpoints use three, independent of history size. Frequencies group `drawing_numbers` in SQL and expand only the bounded 35/45/90-number range in PHP. Rankings reuse those aggregate counts. Parity uses SQL per-set counts followed by grouped distribution counts; only distribution groups reach PHP. Pairs use a SQL same-set self-join with a database result limit. Yearly trends use SQL grouping and distinct drawing/set counts to avoid join multiplication.

The existing game/year/week and game/date drawing indexes and unique drawing/type and set/number indexes support these joins. No schema changes, caches, precomputed tables, or raw-history loading are needed. Date predicates retain the results API's SQLite date conversion semantics, which can limit use of the date portion of the game/date index. Pair aggregation groups all qualifying pairs before sorting and limiting; a smaller result limit does not reduce this aggregation work. Reassess measured performance if the dataset grows substantially.

Phase 4.7 read-only verification on 2026-10-10 used SQLite 3.40.1 and 6,894 drawings (Five 3,631; Six 1,854; Scandinavian 1,409). Five/Six main-number occurrence totals were 18,155/11,124; Scandinavian machine/manual each had 9,863 and combined had 19,726 across 2,818 eligible sets. Five-run local medians for the aggregation service, including population queries but excluding HTTP bootstrap, were approximately 5-8 ms for frequencies and 14-26 ms for pairs across these scopes. The combined pair query plan used the existing drawing and covering set/number indexes, plus temporary B-trees for grouping/sorting. These are local observations, not production latency guarantees. HTTP summaries, frequencies, parity, pairs, trends, and filtered populations were internally consistent; selected number-7 counts also matched the local source snapshots after trimming number whitespace and excluding Six bonus values.

Counts describe available imported historical records, not necessarily complete years of operation. Preserved historical identities and missing dates follow the import rules above. These descriptive statistics do not predict future winning numbers or recommend selections.
