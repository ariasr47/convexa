# R3 — ux ↔ pm

One exchange. Conflicts `22159b6e…`, `75e92688…`, `dadbf06b…` only.
Honor PM self-revision `7a05fb03…` and UX `67b8aeeb…`.
Stay in UX lane: copy integrity, occupancy states, operator literals.
Not this pair: aggregates In/Out; universe gzip retention.

## Converged

### `22159b6e…` — inspect store-absent is not miss (raised by pm against ux)

**Quote I withdraw as inspect copy:** "After the publish clock, a due absent vendor file is **`miss`**, not empty extract, not not-elapsed."

**CONVERGED.** PM is right on inspect. That sentence vouches a vendor hole. Inspect is zero S3 (already agreed). Store-absent after due, with no proved 404, is not vendor-absent. Printing `flat files miss: vendor file for {ET_DATE} due and absent` on that path is copy the data does not support (`absent-is-not-none`).

`miss` prints only when vendor absence is proved (keep GET → 404 / no-such-key after due). Inspect without that proof does not print `miss`. Empty extract and not-elapsed stay distinct. Keep CLI non-zero remains for proved miss.

I will not print `Unattempted` (type-level, not an operator occupancy word). Inspect’s distinct class is **`no stored extract`**.

### `75e92688…` — “not obtained” after due is not miss (raised by ux against pm)

**Quote already retracted by PM `7a05fb03…`:** "Given D is due and the entitled class is not obtained, occupancy is **miss** — not not-elapsed, not empty extract, not an empty session-day tape, not not-storing."

**CONVERGED** on that retraction. I withdraw the inspect half of my R2 proposal (“or inspect of a named due D with no stored object (BRIEF)”). BRIEF’s “missing file after it is due is a miss” does not license inspect-without-GET as `miss`.

Keep remainder (unchanged, and now matching PM):

- `miss` = due **and** vendor 404 / no-such-key proved on keep.
- Keep transport / unknown failure without absence confirmation → `download failed`, not miss.
- Truncated / unusable stored body → `unreadable`.
- Credential refuses never print as miss (`67b8aeeb…`: missing pair ≠ wrong-credential-class ≠ HTTP unauthorized).

### `dadbf06b…` — live-tape / live-paid-present are not this vehicle’s outcomes (raised by ux against pm)

**Quote I will not print as this deck:** "Not-elapsed, miss, empty extract, unreadable, not-storing, missing-files-credentials, wrong-credential-class, ineligible-weekend, not-in-watchlist, unauthorized, kept, live-tape, and live-paid-present outcomes are distinguishable in operator keep/list/load without reading source."

**CONVERGED.** Listing `live-tape` and `live-paid-present` as keep/list/load outcomes puts poison tokens on this vehicle. Success occupancy is **`kept`**, never `present`. `live tape` is a foreign class (session-day-tape / ticker Live tape) and must not appear as a flat-file cell. Those two are distinguished **by absence**; poison tests fail if the literals appear here.

AC-23’s second sentence already bans coverage/tape literals as this occupancy. The outcome list must not contradict that ban.

### Honored self-revisions (not reopened)

- **`7a05fb03…` (PM):** AC-15 breadth withdrawn. Miss is not automatic on every not-kept after due.
- **`67b8aeeb…` (UX):** one `flat files unauthorized` line plus REST-apiKey clause on a mere missing pair withdrawn. Missing pair ≠ wrong-credential-class ≠ HTTP unauthorized.

### SPEC §3 fold (copy / states only)

| Fold | Criterion | Verify by |
|---|---|---|
| PM **AC-15** restated | Given D is due and keep proves vendor 404 / no-such-key, occupancy is **`miss`** — not not-elapsed, not empty extract, not download-failed, not no-stored-extract, not not-storing. Inspect of a due date with no stored object and no proved 404 is **not** this row. | **test** |
| UX **AC-U17** restated | Keep, due, proved 404 / no-such-key → `flat files miss: vendor file for {ET_DATE} due and absent`; keep CLI **non-zero**. Inspect never GETs S3 to mint this literal. | **test** |
| UX **AC-U35 (SB)** (new; inspect companion) | Inspect / list / load of a due `(S, D, class)` with no stored occupant and no proved 404 prints **`no stored extract`**, **not** `miss`, **not** empty extract, **not** not-elapsed, **not** not-storing; **0 S3** and **0 REST/WS**. HTTP **200** + honest literal. CLI inspect **exit 0**. | **test** |
| UX **AC-U36 (SB)** (new; keep companion) | Armed keep, due, credentials present, GET without absence confirmation (not 404 / no-such-key) prints **`flat files download failed: vendor file for {ET_DATE} not confirmed`**, not miss, not empty extract. Keep CLI **non-zero**. | **test** |
| PM **AC-23** restated | Printed deck on this vehicle is the closed list in **Operator literals** below. `live-tape` and `live-paid-present` are **not** members; distinguished by absence. Coverage `present` / `missing` / `not yet due` / `blocked occupancy` and session-day-tape literals never appear as this occupancy. Success word is **`kept`**. | **test** |
| UX **AC-U6** add | `not-elapsed` ≠ `miss` ≠ `no stored extract` ≠ `empty extract` ≠ `unreadable` ≠ `not-storing` ≠ `download failed` ≠ `missing-files-credentials` ≠ `wrong-credential-class` ≠ HTTP `unauthorized`. Live-tape is foreign, not a cell. | **test** |
| UX **AC-U8** | Success occupancy remains **`kept` / `kept from Massive flat files`**, never `present`, never `Stored`. | **test** (unchanged) |
| UX **AC-U19** restated (`67b8aeeb…`) | Missing files pair → `flat files unauthorized` / `missing-files-credentials`, **no** REST-apiKey clause, **no** fetch. Live key in the files slot → `wrong-credential-class` + `REST apiKey is not the files secret`, **no** fetch. HTTP token miss → shipped `metrics_unauthorized` only. None of these print as miss. | **test** |
| UX **AC-U12** | Inspect still **0 S3** including on `no stored extract`. Do not call S3 to “confirm” a hole. | **test** (unchanged duty) |
| UX **AC-U26** | A **proved** universe-file miss is one day-file fact inherited by the watchlist — not three ticker 404s. `no stored extract` of that object is the same inheritance. | **test** |
| UX **AC-U30** / PM **AC-53** | Exact standing / glossary / is-is-not English, including the miss vs no-stored-extract hedge. | **review** |

Hollow “renders without throw” does not satisfy the `test` marks. Prefer one fixture matrix, not one-test-per-AC.

## What I withdraw

1. **Inspect as `miss`.** R1 miss class (“no stored object; vendor 404 after due on keep”), AC-U17, glossary “The vendor file is due and absent” as inspect-inclusive, CLI `[ERROR]` miss on inspect-without-404, HTTP “miss-on-inspect”, and the R2 `75e92688…` inspect clause. Store-absent on a zero-S3 read does not prove the vendor file is absent.
2. **`Unattempted` as operator copy.** I will not print it to name inspect store-absent or keep-without-404.
3. **`not-kept` as a bucket cell.** It would collapse miss, download-failed, credentials, and inspect store-absent — the same `absent-is-not-none` failure as AC-15 breadth.
4. **Collapsed unauthorized (`67b8aeeb…`).** R1 AC-U19 / CLI line that printed `REST apiKey is not the S3 secret` on a mere missing pair. The REST clause asserts a substitution that run did not perform.
5. **Nothing on `live-tape` / `live-paid-present` as outcomes.** I do not withdraw the poison. I hold `dadbf06b…`.
6. **Nothing on success `kept`.** I do not rename it `present` or `Stored`.

Not withdrawn, not this pair: standing `· aggregates` only if the human locks aggregates In; omit the column if Out. Occupant claim stays the watchlist extract; no “full-universe keep” store assertion (`8b39d0dd…`).

## Operator literals I will print

Closed printed deck on this vehicle (keep / list / load). These are the only occupancy words. Never synonyms.

| Occupancy | When (vouched) | Exact operator-facing line | Not |
|---|---|---|---|
| **`kept`** | Stored readable extract; ≥1 row of that class | `kept from Massive flat files` · CLI `[OK] flat-files — kept from Massive flat files · not a live paid session book · not a session day tape · local audit is not production coverage` | `present`; `Stored`; `live`; `live_massive`; `Live tape` |
| **`not-elapsed`** | Publish clock not passed | `flat files not elapsed: vendor file for {ET_DATE} not yet published` · CLI `[OK]` · **Not a miss.** · exit 0 | `miss`; `no stored extract` |
| **`miss`** | **Keep** proved vendor 404 / no-such-key after due | `flat files miss: vendor file for {ET_DATE} due and absent` · keep CLI `[ERROR]` **non-zero** | inspect-without-404; empty extract; download failed; no stored extract |
| **`no stored extract`** | **Inspect** of due D; store has no occupant; 404 not proved; 0 S3 | `flat files no stored extract: {ET_DATE}` · HTTP `RESEARCH READ — NO MASSIVE FLAT FILES` · **200** · CLI inspect `[OK]` exit 0 | `miss`; empty extract; not-elapsed; not-storing; `Unattempted` |
| **`empty extract`** | File present and readable; this watchlist symbol has 0 rows | `flat files empty extract: {SYMBOL} on {ET_DATE}` · inspect exit 0 | `miss`; no stored extract; “complete session, 0 prints” |
| **`unreadable`** | Object/pointer exists; body not readable | `flat files unreadable: {reason}` · CLI non-zero | miss; empty extract; kept |
| **`not-storing`** | Dedicated root unset / unwritable / disabled | `flat files not storing` · CLI non-zero | a miss grid; a no-stored-extract grid |
| **`download failed`** | Keep GET ran; absence **not** confirmed (not 404 / no-such-key) | `flat files download failed: vendor file for {ET_DATE} not confirmed` · keep CLI `[ERROR]` non-zero | miss; empty extract; inspect path |
| **`missing-files-credentials`** | Armed keep; files pair absent; **zero** fetch | `flat files unauthorized` — **no** REST-apiKey clause | miss; wrong-credential-class; HTTP unauthorized |
| **`wrong-credential-class`** | Live REST key in the files slot; **zero** fetch | `REST apiKey is not the files secret` | miss; missing-files-credentials; HTTP unauthorized |
| **`ineligible-weekend`** | Named D is ET Saturday or Sunday | `flat files ineligible weekend: {ET_DATE}` · exit 0 · not a miss | miss; empty extract |
| **`not-in-watchlist`** | Name not SPY / QQQ / IWM | `not in flat-files watchlist: {SYMBOL}` | empty extract; miss |
| **HTTP `unauthorized`** | Operator token missing/wrong when required | shipped **`metrics_unauthorized`** only | `flat files unauthorized`; miss |

**Inspect vendor-I/O refuse** (not an occupancy cell): `[ERROR] flat-files — inspect must not call REST/WS or S3. No load recorded.`

**Envelope (HTTP inspect, due, no occupant):** `RESEARCH READ — NO MASSIVE FLAT FILES` — occupancy cell is `no stored extract` unless a **stored** miss record already vouches a proved 404. Envelope is not a keep success.

**Success word:** `kept`. Never `present`. Never `Stored`. Never `live-paid-present`.

**Poison on this vehicle (distinguished by absence; GATE Q fails if they appear as this occupancy):** `live-tape`, `live tape`, `Live tape`, `live-paid-present`, `present`, `Stored`, `Unattempted`, `live`, `LIVE`, `live_massive`.

**Glossary (miss / no stored extract / download failed only; others unchanged):**

| Term | Sentence |
|---|---|
| kept | That extract is stored and readable. Not coverage `present`. Not live Massive. |
| miss | Keep proved the vendor file due and absent (404 / no-such-key). Distinct from empty extract, not-elapsed, download failed, and no stored extract. |
| no stored extract | Inspect found no occupant. Zero S3. Does not prove the vendor file is absent. Distinct from miss, empty extract, not-elapsed, and download failed. |
| download failed | Keep attempted; vendor absence was not confirmed. Not a miss. |
| empty extract | The file is present; this watchlist symbol has zero rows. Distinct from miss and from no stored extract. |
| live tape | **Not a flat-files word.** Session day tape / ticker Live tape only. This corpus must not print it. |
| present | **Not a flat-files word.** On coverage, a loadable live paid session book. |

**Universe inheritance:** a proved miss, a download-failed, or a no-stored-extract of the universe day file is **one day-file fact**, then inherited by SPY / QQQ / IWM. Do not print three independent ticker 404s. `empty extract` and `kept` row counts remain per symbol after a file is present.

**Is / is not (kept / empty extract / no stored extract inspect):** still not a live paid session book; not coverage `present`; not `live_massive`; not the session day tape; not Path-A; not ticker playback. No stored extract does **not** add “vendor file due and absent.”
)
