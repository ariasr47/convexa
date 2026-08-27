# archive-coverage-guardrails — interface contract

This backend/operations feature adds one object to the existing operator metrics response. `NO_UI_CHANGE` applies. The local `archive-coverage-audit` command is specified in `SPEC.md`; it is not an HTTP endpoint.

## Endpoint

### `GET /api/_metrics`

**Purpose:** Return the existing read-only operator metrics plus the latest immutable session-archive coverage snapshot. The request itself reads no archive body/index, calls no vendor, wakes no worker, performs no repair/recompute, and mutates no archive, database, cache, or trader state.

**Authorization:** This remains the existing operator-token boundary, not session-cookie authentication. In production, either `Authorization: Bearer <METRICS_SECRET_TOKEN>` or `X-Metrics-Token: <METRICS_SECRET_TOKEN>` is required. Missing/incorrect credentials return `401` with the existing error response and no coverage object. When the token is deliberately unset in a local/conformance harness, the endpoint remains open as it is today. The trader-origin proxy continues to return 404 for `/api/_metrics`.

**Success:** `200 application/json`. All existing response fields remain additive-compatible. One top-level `session_archive_coverage` object is added:

| Field | Type | Meaning |
|---|---|---|
| `status` | `current \| stale \| unavailable` | `current` is the latest successful pass; `stale` exposes last-good evidence beside a current inspection failure; `unavailable` means no good evidence exists. |
| `status_detail` | `string|null` | Bounded current failure/degraded explanation; null only for current evidence. Never contains secrets, body locators, absolute paths, or environment values. |
| `data_stale` | `boolean` | True exactly when counts/matrix are retained last-good data rather than a current successful evaluation. |
| `activation_et_date` | `string` | Fixed owner-ruled coverage start, `2026-08-24`. |
| `checkpoint_et` | `string` | `10:30:00 America/New_York`. |
| `lookback_eligible_sessions` | `number` | Runtime policy value `5`. |
| `evaluated_at_et` | `string|null` | Time of the latest evaluation attempt in America/New_York; null only before any attempt. |
| `last_verified_at_utc` | `string|null` | Time the represented matrix was most recently strictly verified; null when no good snapshot exists. |
| `range.start_et_date` / `range.end_et_date` | `string|null` | Exact bounded runtime range, floored by activation. A successfully computed range remains present even if the first strict inspection is unavailable; both are null only when policy/calendar range computation failed before producing a range. |
| `required_symbols[]` | `string[]` | Closed ordered set `SPY`, `QQQ`, `IWM`. |
| `counts.expected` | `number|null` | Due expected books. Null when unavailable with no last-good snapshot. |
| `counts.present` | `number|null` | Due expected books with index records, including unreadable bodies. |
| `counts.readable` | `number|null` | Due expected books passing strict load/identity verification. |
| `counts.missing` | `number|null` | Due expected books without index records. |
| `counts.unreadable` | `number|null` | Due expected books whose indexed bodies fail read/decode/identity verification. |
| `counts.not_due` | `number|null` | Selected symbol-dates whose checkpoint has not passed; excluded from `expected`. |
| `books[]` | array | Selected symbol-date evidence rows. Each has `symbol`, `et_date`, closed `status`, and nullable `source_as_of`; no body/locator/path is exposed. Empty means no identity evidence was produced and may accompany either a known range or null range under `unavailable`; it never means successful zero coverage. |
| `per_symbol[]` | array | Exactly one row per required symbol with nullable last-readable ET date/source timestamp and current-run write-failure count. Under `unavailable` with no last-good evidence, both last-readable values are null in all three rows while counters remain process-current. |
| `observation.started_at_utc` | `string` | Start of this process-local observation run. |
| `observation.write_failures_total` | `number` | Failed SPY/QQQ/IWM archive inserts observed in this process run; not a missing-book count. |

`books[].status` is one of `readable`, `missing`, `unreadable`, or `not_due`. A `readable` row has a non-null `source_as_of`; all other row statuses have null `source_as_of`. `per_symbol[].last_readable_et_date` and `.last_readable_source_as_of` are either both strings or both null. `per_symbol[].write_failures_since_observation` is process-local and sums to `observation.write_failures_total` across the closed three-symbol set.

When `status=current`, `status_detail` is null, `data_stale=false`, and counts are numbers. When `status=stale`, `status_detail` is non-null, `data_stale=true`, and the matrix/counts retain the timestamped last-good snapshot. When `status=unavailable`, `status_detail` is a bounded non-null reason, `data_stale=false`, `last_verified_at_utc` and all six count values are null, `books=[]`, and every per-symbol last-readable pair is null. If runtime range computation succeeded before strict inspection failed, the known range endpoints remain strings; if policy/calendar range computation failed before a range existed, both endpoints are null. In either case, empty books means no evidence and no completeness claim, not zero expected books.

**Error semantics:**

- `401 application/json` for a missing/incorrect production operator token, using the existing `{error, detail}` denial and exposing no `session_archive_coverage`.
- Coverage inspection failure does not change the authorized endpoint's HTTP status to 5xx; it is represented by `stale` or `unavailable` as above.
- Historical/current missing or unreadable books never change the endpoint from 200 and never authorize repair, scoring, or trader action.

## Conformance spec

The generic interface runner cannot inject the operator's arbitrary metrics header. The G1 live-shape run therefore uses a local harness with `METRICS_SECRET_TOKEN` deliberately unset and primes one evaluator pass before the request. Dedicated route tests must separately prove both accepted operator-token headers and the 401 denial. `auth` is intentionally absent below because runner `auth` means session-cookie authentication, which is not this endpoint's boundary.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_metrics",
      "path_params": {},
      "query": {},
      "required": {
        "session_archive_coverage.status": "string",
        "session_archive_coverage.status_detail": "string|null",
        "session_archive_coverage.data_stale": "boolean",
        "session_archive_coverage.activation_et_date": "string",
        "session_archive_coverage.checkpoint_et": "string",
        "session_archive_coverage.lookback_eligible_sessions": "number",
        "session_archive_coverage.evaluated_at_et": "string|null",
        "session_archive_coverage.last_verified_at_utc": "string|null",
        "session_archive_coverage.range.start_et_date": "string|null",
        "session_archive_coverage.range.end_et_date": "string|null",
        "session_archive_coverage.required_symbols[]": "string",
        "session_archive_coverage.counts.expected": "number|null",
        "session_archive_coverage.counts.present": "number|null",
        "session_archive_coverage.counts.readable": "number|null",
        "session_archive_coverage.counts.missing": "number|null",
        "session_archive_coverage.counts.unreadable": "number|null",
        "session_archive_coverage.counts.not_due": "number|null",
        "session_archive_coverage.books[].symbol": "string",
        "session_archive_coverage.books[].et_date": "string",
        "session_archive_coverage.books[].status": "string",
        "session_archive_coverage.books[].source_as_of": "string|null",
        "session_archive_coverage.per_symbol[].symbol": "string",
        "session_archive_coverage.per_symbol[].last_readable_et_date": "string|null",
        "session_archive_coverage.per_symbol[].last_readable_source_as_of": "string|null",
        "session_archive_coverage.per_symbol[].write_failures_since_observation": "number",
        "session_archive_coverage.observation.started_at_utc": "string",
        "session_archive_coverage.observation.write_failures_total": "number"
      }
    }
  ]
}
```
