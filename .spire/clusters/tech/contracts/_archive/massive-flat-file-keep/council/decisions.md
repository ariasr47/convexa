# massive-flat-file-keep — council decisions

R3 input: `council/conflicts.json` (17 conflicts, 17/17 quotes verified, 6 product / 11 technical, 3 self-revisions).

## Self-revisions (folded; not human, not a re-spawn)

- PM withdraws AC-15 breadth (`7a05fb03…`): “Given D is due and the entitled class is not obtained, occupancy is miss” collapsed Unattempted / download-failed / unauthorized / 404 into one miss. Retracted. Miss is not automatic on every not-kept after due.
- UX withdraws collapsed unauthorized (`67b8aeeb…`): one `flat files unauthorized` line plus REST-apiKey clause on a mere missing pair. Retracted. Missing pair ≠ wrong-credential-class ≠ HTTP unauthorized.
- UX withdraws standing “not a full-universe keep” as a store fact (`8b39d0dd…`): cannot vouch until the occupant lock lands. Still-defensible: no full-universe redistribution claim; no open-to-close completeness claim.

## Unanimous / conductor folds (no exchange)

- Dedicated body root, not `SESSION_DAY_TAPE_BODY_ROOT`. Collision with tape / archive / ring does not occupy those roots.
- Distinct S3 Access Key + Secret; never reuse `MASSIVE_API_KEY` as the files secret.
- No Path-A conversion / ticker replay this slice. `session-day-replay` stays on the day-tape store.
- No OPRA / indices / crypto / hist-chain this slice.
- Trader UI `NO_UI_CHANGE`. Pages still 404s `/api/_research`. No player chrome.
- Never `LiveMassive` / coverage `present`. `Authorizes: nothing` on score.
- Locked watchlist SPY / QQQ / IWM. Files are universe-per-day; operator claim is per locked name.
- Production unset still talks to Massive REST/WS. No serve poller this slice.
- Evidence: local. Local keep is not hosted/CI.

## Human product rulings

- **2026-08-30 aggregates this slice — A.** Conflicts `50267389…`, `d8f79bcd…`, `6f4bbe4c…`.
  This slice keeps stocks SIP **trades_v1 + quotes_v1 only**. Session-bar aggregates are a
  **closed product slot** (Future): not fetched, not stored, not listed, not claimed. Standing
  and list omit an aggregates column entirely — do not print `0 aggregates`. Occupancy for
  trades and quotes is independent; a later aggregates slice must not restate provenance as
  `LiveMassive` / coverage `present`. Derived OHLCV from the trades extract is not the
  aggregates class.
- **2026-08-30 universe gzip retention — A.** Conflicts `0141cfb0…`, `b0e9bbb0…`, `b0339d4f…`.
  Durable occupant is the locked-name **extract** per `(symbol, ET date, class)`. Keep may
  stream the universe gzip through a temp file, extract SPY/QQQ/IWM, then **discard** the
  universe object (no durable full-market file this slice). After cancel, list/load of already
  kept extracts is zero vendor. Rebuilding a fourth name from that day’s universe file is
  Future (would need re-GET or a later gzip-keep slice). Standing: watchlist extract · not a
  full-universe redistribution · not a full open-to-close claim. Research load returns extract
  only. No completeness percent.

- **2026-08-30 S2 pass-2 Critical — A.** Partial-trio keep then later 404 must **not** persist `miss` for `(D, class)` if any locked-name extract already exists for that pair. Never vouch “vendor file absent” beside a sibling keep from that universe file. Later 404 in that situation is not-confirmed / download-failed (or skip GET), not miss. First-wins on existing kept **or empty-extract** occupants stands (empty extract is a content-hit). Skip-GET and files-call are per entitled class.

## Pending human product rulings

- none

## Technical exchanges (one round; all converged)

- **Miss vs not-confirmed — architect ↔ pm.** Miss is only keep GET after due that returns vendor 404 / NoSuchKey, persisted so list/load stays zero-vendor. GET-not-run inspect is not miss. Transport / no-rename / vendor-down without 404 is not-confirmed-fetch (print: download failed). 401/403 after GET is not miss. Promoted unusable body is unreadable. Pre-GET credential refuse is unauthorized family (missing-files-credentials ≠ wrong-credential-class). Not-storing is unset/unwritable root. AC-15 breadth stays retracted.
- **Collision / credentials / Stored→kept — architect ↔ ux.** Keep-root collision with tape/archive/ring refuses **armed keep** (`refuse to mix`); `serve` still binds and talks to Massive. Missing files pair vs live REST key in the files slot: two pre-GET refuses, zero files GET. Type-level Stored is not the operator word; success is `kept` only for a readable extract with ≥1 rows; ExtractEmpty prints `empty extract`. Never print `Unattempted`, `present`, `Stored`.
- **Inspect miss + poison tokens — pm ↔ ux.** Inspect of a due date with no stored object and no proved 404 prints `no stored extract`, not miss. Printed deck does not list `live-tape` or `live-paid-present` as outcomes (distinguished by absence; poison if they appear). Success word `kept`, never `present`.

## Pending technical exchanges

- none
