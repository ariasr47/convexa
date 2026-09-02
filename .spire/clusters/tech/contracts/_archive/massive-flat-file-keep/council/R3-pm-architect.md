# R3 — pm ↔ architect

Pair on conflict `1eba46ca4b905d35549f2fda4ba8f0e4e16bbc15d826fb8851e85b616890833f` (architect → pm), quoting my R1 sentence “Occupancy is miss or unreadable as appropriate — not kept.” Honor self-revision `7a05fb03…`. Session-bar aggregates In/Out and universe gzip retention are **not** settled here.

## Converged

**Yes.** Due is a clock, not a hole. After D is due, “the entitled class is not obtained” is several observables. Only one of them is miss. A later successful keep of a not-confirmed-fetch must not read as filling a hole that was never proved.

Operator occupancy (observable on keep/list/load without reading source). Architect type names are an implementation mapping, never printed:

| Occupancy | When it is true | Distinct from |
|---|---|---|
| **miss** | D is due **and** a keep proved the entitled vendor object absent (vendor 404 / no-such-key). One universe-file fact, inherited by the locked names — not three independent per-ticker vendor-file misses. | empty extract; not-elapsed; not-confirmed-fetch; unreadable; unauthorized; not-storing; kept |
| **not-confirmed-fetch** | D is due **and** absence is **not** proved: GET not run; inspect of a named due D with no stored occupant and no proved 404 (inspect does not fetch to “confirm”); transport / timeout / vendor-down / non-404 failure; or 401/403 **after** a GET. Retry is allowed. | miss; kept; empty extract; unauthorized (pre-GET refuse); not-storing; unreadable |
| **unreadable** | A stored occupant/pointer **exists** for that identity and cannot be loaded as reconstructable history. | miss; empty extract (readable, zero rows); not-confirmed-fetch (nothing promoted into store); not-storing; kept |
| **unauthorized** | Armed keep **refuses before any files GET**: files credential pair absent (**missing-files-credentials**) or live REST/WS key offered as the files secret (**wrong-credential-class**). Files-call count 0. HTTP research-read without the operator token is a **separate** unauthorized (no extract body). | miss; not-confirmed-fetch; not-storing |
| **not-storing** | Keep store disabled / root unset / unwritable. Desk still serves. No false kept. | miss; unauthorized; unreadable; a grid of misses |

Mapping I accept from architect’s closed occupancy:

- Miss → **miss**
- Unattempted (GET not run, transport, 401/403 without absence confirmation) → **not-confirmed-fetch**. Never print Unattempted. Never print Stored. Never print present.
- Unreadable → **unreadable**
- NotStoring → **not-storing**
- ExtractEmpty → **empty extract** (file obtained; locked S has zero rows)
- NotElapsed → **not-elapsed**
- Ineligible → **ineligible-weekend**
- Stored with ≥1 extract rows → **kept** / **kept from Massive flat files**
- Missing local files pair remains refuse-before-GET, **unauthorized** family, distinct from Unattempted / not-confirmed-fetch

401/403 after GET is **not** missing-files-credentials and **not** miss. A fetch happened; the object was not proved absent → **not-confirmed-fetch**. A crash-temp that was never promoted is **not-confirmed-fetch**, not unreadable. Unreadable requires a named stored occupant.

BRIEF “A missing file after it is due is a miss, not an empty tape” is **proved vendor absence after due**, not “we do not hold a local occupant.” Empty extract remains zero rows on an obtained file. Empty session-day tape remains a foreign class.

Fetch/write fault still never 5xxs the desk and never records kept. Per-class independence stands: a miss or not-confirmed-fetch of one class does not rewrite another class to kept. UX owns exact print strings; product owns that those strings cannot say miss unless 404 / no-such-key is proved.

## What I withdraw

1. **AC-15** as written: “Given D is due and the entitled class is not obtained, occupancy is **miss** — not not-elapsed, not empty extract, not an empty session-day tape, not not-storing.” That is self-revision `7a05fb03…`. Retracted in full.
2. Due-clock lock and closed product rule 4: “At or after that checkpoint, an entitled class not obtained: **miss**” / “Not-elapsed before; miss after if not obtained.” After the clock the day is **due**. Miss is not the residual.
3. Degraded row: clock at/after 11:00 ET on D+1, entitled class **not obtained** → **Miss.**
4. Degraded row and the quoted sentence: “Keep / fetch **faults** after due (vendor down, truncated unusable file, write fail) … Occupancy is **miss** or **unreadable** as appropriate — not kept.” Vendor-down and write-fail-without-a-promoted-occupant are **not-confirmed-fetch**. Promoted unusable body is **unreadable**. Neither is automatically miss.
5. **AC-26** evidence that occupancy after fetch/write fault is “miss or unreadable.” Occupancy is **not kept**; the class is not-confirmed-fetch or unreadable per the table — never automatic miss.
6. **AC-5** evidence “quotes absent after due → quotes miss.” Class independence remains. Quotes are miss only when that class’s 404 / no-such-key is proved; otherwise not-confirmed-fetch. (Whether session-bar aggregates ship is the pending human lock.)
7. Product decision 9: “Vendor gone → miss.” After cancel, a never-kept due day is **not-confirmed-fetch** or **unauthorized**, not a fabricated hole. Already-kept extracts still list/load with zero vendor calls (AC-10).
8. Hermetic-pass / GATE Q notes that treat every post-due gap as miss (“plant quotes absent after due → quotes miss”).

Replacement rows (one observable each; degraded split; Verify by `test` — silent miss-fabrication is a hole a reviewer will not see):

- **AC-15** Given D is due and a keep proves the entitled vendor object absent (404 / no-such-key), occupancy is **miss** — not not-elapsed, not empty extract, not not-confirmed-fetch, not unreadable, not not-storing, not unauthorized.
- **AC-15a** Given D is due and vendor absence is not proved (GET not run; inspect of due D with no stored occupant; transport / vendor-down / timeout / non-404; 401/403 after GET), occupancy is **not-confirmed-fetch** — not miss, not kept, not empty extract, not unauthorized, not not-storing.
- **AC-26** If keep fetch or write fails after due, bundle / scan / live stream / session-ensure still succeed; occupancy is not kept; no false stored success; the occupancy class follows AC-15 / AC-15a / AC-17, never automatic miss.

## Observables that remain

On operator keep/list/load per `(symbol, ET date, file class)`:

- **kept** — reconstructable extract, ≥1 rows; never present, never Stored, never live Massive.
- **empty extract** — entitled file obtained; locked S has zero rows for that class.
- **not-elapsed** — before 11:00 ET on calendar D+1; no fetch; not miss.
- **miss** — due and vendor 404 / no-such-key proved on keep.
- **not-confirmed-fetch** — due and absence not proved.
- **unreadable** — stored occupant exists; cannot load as history (AC-17 unchanged).
- **not-storing** — store disabled / unset / unwritable (AC-18 unchanged).
- **unauthorized** — pre-GET files-credential refuse (**missing-files-credentials** ≠ **wrong-credential-class**) and HTTP token miss on research read. Never miss. AC-19 / AC-20 / AC-45 unchanged in outcome, now also distinct from not-confirmed-fetch.
- **ineligible-weekend**, **not-in-watchlist** — unchanged.
- Retry: miss may become kept once the object is obtainable; not-confirmed-fetch may become kept; already-kept is not overwritten by empty extract or unreadable (AC-25, with not-confirmed-fetch added as a retryable predecessor).
- S4 inequality: not-elapsed ≠ miss ≠ not-confirmed-fetch ≠ empty extract ≠ unreadable ≠ not-storing ≠ missing-files-credentials ≠ wrong-credential-class ≠ ineligible-weekend ≠ not-in-watchlist ≠ unauthorized ≠ kept. Coverage `present` / `missing` / `not yet due` / `blocked occupancy` and session-day-tape literals still never appear as this corpus’s occupancy. AC-23 gains **not-confirmed-fetch** as a distinguishable cell.
- Desk isolation, production-unset does not fetch, coverage holes stay holes, tape occupancy unchanged — unchanged.

Not settled in this exchange: session-bar aggregates In/Out; whether this slice also retains the universe gzip. Occupancy rules above apply to whatever entitled classes the human locks.
