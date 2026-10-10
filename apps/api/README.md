# Lottery Stats API

This application provides the Laravel 13 / PHP 8.5 backend and read-only results and statistics APIs, backed by SQLite. Official drawings can be synchronized through Artisan.

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

Phase 4.7 read-only verification on 2026-10-10 used SQLite 3.40.1 and 6,894 drawings (Five 3,631; Six 1,854; Scandinavian 1,409). Five/Six main-number occurrence totals were 18,155/11,124; Scandinavian machine/manual each had 9,863 and combined had 19,726 across 2,818 eligible sets. Five-run local medians for the aggregation service, including population queries but excluding HTTP bootstrap, were approximately 5-8 ms for frequencies and 14-26 ms for pairs across these scopes. The combined pair query plan used the existing drawing and covering set/number indexes, plus temporary B-trees for grouping/sorting. These are local observations, not production latency guarantees. HTTP summaries, frequencies, parity, pairs, trends, and filtered populations were internally consistent; selected number-7 counts also matched the local source snapshots after trimming number whitespace and excluding Six bonus values. The persistent SQLite file's SHA-256 was unchanged throughout verification.

Counts describe available imported historical records, not necessarily complete years of operation. Preserved historical identities and missing dates follow the import rules above. These descriptive statistics do not predict future winning numbers or recommend selections.
