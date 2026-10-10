# Lottery source normalization

`App\Lottery\LotteryPayloadNormalizer::normalize($gameCode, $payload)` accepts an already-decoded feed payload and returns a list of readonly `NormalizedDrawing` values. It does not use Laravel HTTP, Eloquent, or a database. The payload's aggregate `numberStatistics` member is ignored; only `drawings` are normalized. An empty or malformed drawing list fails rather than looking like a successful empty import.

## Local source audit

This audit used only `.references/data/otos.json`, `hatos.json`, and `skandi.json`; the references were not modified. Each has a top-level object with `drawings` and `numberStatistics`. Drawing rows carry numeric `year` and `week`, a dotted date string or empty string, a `numbers` array, and game-specific `*HitCount` / `*HitPrize` fields. The examples below are representative local rows:

- Ötöslottó 2026 week 40: date `2026.10.03.`, numbers `9,48,51,83,88`; the source has prize tiers `2`, `3`, `4`, `5`.
- Hatoslottó 2007 week 29: date `2007.07.22.`, numbers `8,13,14,17,19,45,20`; `5P1HitCount` is `1` and `5P1HitPrize` is `29 525 700 Ft`.
- Skandináv lottó 2026 week 41: date `2026.10.07.`; the fourteen values are two consecutive seven-number groups, machine first and manual second, as also reflected in the local legacy UI.
- Oldest inspected rows include undated Ötöslottó 1957 week 10, Hatoslottó 1988 week 43, and Skandináv lottó 1999 week 41. Empty dates normalize to `null`; no dates are synthesized.

Observed feed sizes were 3,631 Ötöslottó, 1,854 Hatoslottó, and 1,409 Skandináv lottó records. Ötöslottó dates are empty in 2,487 records and Hatoslottó has 57 year/week groups with two distinct dated draws. The source year/week are retained as supplied: for example, Ötöslottó 2025 week 52 has date 2026-01-01, and Hatoslottó includes 2017 week 52 dated 2018-01-01. Therefore the normalizer validates the date itself but does not impose ISO-week/date agreement. A source number string with trailing whitespace occurs in Ötöslottó; whitespace is trimmed before parsing. The observed main arrays are ascending, and Skandináv's two groups are each ascending, but the normalizer sorts each group as a set and does not interpret array position as draw order. Hatoslottó's historical bonus appears as a seventh value; later records can contain an empty seventh slot, while newer records may have only six values.

## Normalized contract and rules

`NormalizedDrawing` contains the game code, stable `sourceKey`, source year/week, nullable `DateTimeImmutable` draw date, a list of `NormalizedNumberSet` values, and available `NormalizedPrizeTier` values. Set identifiers are `main`, optional `bonus`, `machine`, and `manual`. Number values are sorted integers; each game's required count and range are enforced (five: 5 in 1–90; six: 6 main in 1–45 plus optional distinct bonus; Scandinavian: 7 machine and 7 manual in 1–35). Overlap between Scandinavian sets is valid. Hatoslottó `5P1` prize data is omitted when no bonus exists; a nonzero 5P1 payout without a bonus is rejected.

Prize tiers are the tiers present in that game's source row: five has `match_2` through `match_5`, six has `match_3`, `match_4`, `match_5`, `match_5_plus_1`, and `match_6`, and Scandinavian has `match_4` through `match_7`. Winner counts are nullable integers. Amounts are nullable exact decimal strings with two places and `HUF` currency when present; parsing uses no floating point. Grouping whitespace and the `Ft` suffix are removed. Missing tier fields do not create tiers. A lone zero tier stays zero when other tiers have data.

The local feeds contain complete all-zero prize vectors in 2,130 Ötöslottó records (1957–1997) and 295 Hatoslottó records (1988–1997). The source does not distinguish an unavailable/placeholder historical prize from an actual zero payout. Conservatively, the normalizer maps a complete all-zero vector for these two feeds to null values for those existing tiers. This is an explicit inference and needs confirmation against authoritative historical semantics before prize analysis; it never invents a payout. No equivalent Skandináv placeholder pattern was observed, so its zero values are retained. The inspected feeds have no fractional amounts or missing prize fields, so those parser paths accept null/empty values for future source variants but are not corroborated by the current snapshots.

## Identity, duplicates, and failures

There is no universal source record ID. A dated record uses `date:YYYY-MM-DD` as its key, independent of prize data and number order. An undated record uses `undated:YYYY-Www:` plus a SHA-256 digest of the normalized, labeled number sets. This allows multiple same-week drawings with different sets and keeps Scandinavian machine/manual sets in one drawing. Keys do not depend on record index, raw JSON formatting, prize amounts, or winner counts.

Identity cannot be perfect without an official ID. Correcting the number set of an undated record changes its key; adding a date to an undated record also changes its key. Two different records with the same date are ambiguous under the available evidence and fail the batch. Exact normalized duplicates sharing a key are returned once; different records sharing a key fail instead of overwriting. The exception reports game code, zero-based input record index when applicable, field, and concise reason without embedding source data. Any invalid or conflicting row rejects the entire payload; records are not silently dropped.

Date and numeric parsing is strict. Invalid dates, malformed counts or amounts, duplicate/out-of-range numbers, unsupported row fields, and inconsistent bonus payouts fail normalization. Source year/week are validated as positive year and week 1–53, but no ISO-calendar equivalence is assumed. Prize placeholders and source year/week/date semantics are assumptions for importer review; the source identity strategy should be revisited if an authoritative stable identifier is discovered.
