# R3 — pm ↔ ux

Pair: `22159b6ed94263cae78d1dee5f0630465bfe378de96ad13921007e8ef4a1f9bc` (pm → ux, inspect miss), `75e926882b411ac1f1eb9cda762cecb2f42ef7cc501fb341990e40bf3223d4bd` (ux → pm, miss vs download-failed), `dadbf06b4da5165103f2011d694bb4f241259f51e94820a7e2ad075e2c4042a3` (ux → pm, live-tape / live-paid-present as outcomes).

Honor folded self-revisions `7a05fb03…` (PM retracts AC-15 “not obtained after due = miss”) and `67b8aeeb…` (UX retracts one unauthorized line for missing pair, wrong-credential-class, and HTTP unauthorized). Do not reopen aggregates In/Out or universe gzip retention.

**Converge: yes** on both technical items. I cannot defend inspect-as-miss without fabricating a vendor hole.

## Converged

**1. Miss only when due AND vendor 404 / no-such-key is proved on the keep path.**

Miss is a keep-path occupancy. Session D is due, files credentials are present, the store is storing, keep runs, and the files product answers 404 / no-such-key. The operator sees **miss**. Keep command stays non-zero. That miss is not empty extract, not not-elapsed, not not-storing, not download-failed, not a credential refuse.

Inspect / list / load of a due D with **no stored object** and **no proved 404** is a distinct **not-kept** class (GET not run). Inspect makes zero files-product calls and does not mint miss by looking at an empty store. Printing UX’s miss literal (`flat files miss: vendor file for {ET_DATE} due and absent`) on that inspect vouches a vendor hole nobody proved — the same collapse `7a05fb03…` already retracted. There is no inspect-as-miss observable that stays honest.

If a prior keep already proved 404 and that identity still reports miss, later inspect may show miss with zero files calls. That is reporting a proved fact, not inferring absence from emptiness.

Keep after due where GET runs but absence is **not** confirmed (vendor down, transport, non-404) is **download-failed** — UX’s already-locked `flat files download failed: vendor file for {ET_DATE} not confirmed` — not miss, not kept, not empty extract. Truncated / unusable stored body is **unreadable**, not miss. Write / root failure is **not-storing** or refuse-to-mix, not miss.

Credential refuses stay three-way per `67b8aeeb…`: missing files pair ≠ wrong-credential-class ≠ HTTP unauthorized. None of those print as miss. None of those are not-kept inspect.

Empty extract remains file-obtained, zero rows for the locked name. Not-elapsed remains before the publish clock, no fetch. Weekend remains ineligible, not miss and not not-kept. Off-watchlist remains not-in-watchlist, not a miss that implies we tried.

The BRIEF sentence “A missing file after it is due is a miss, not an empty tape” splits a proved keep miss from a zero-row extract. It does not license inspect to print vendor-absent.

**2. Printed keep / list / load deck does not list `live-tape` or `live-paid-present` as this vehicle’s outcomes.**

Those classes are distinguished by **absence**. Poison tests fail if those literals appear here. Success occupancy word is **`kept`**, never `present`. `live tape` remains a foreign class (session-day-tape / ticker Live tape). This corpus does not print it as a cell.

This vehicle’s printed occupancy deck is:

kept · not-elapsed · miss · empty extract · unreadable · not-storing · missing-files-credentials · wrong-credential-class · ineligible-weekend · not-in-watchlist · unauthorized (HTTP) · download-failed · not-kept (inspect, due, no stored object, no proved 404)

That is UX’s `dadbf06b…` deck plus the two classes the miss split requires (download-failed already locked in UX R1; not-kept is the inspect class that replaces inspect-as-miss). It does not add `live-tape`, `live-paid-present`, `present`, `Unattempted`, `Stored`, or `live`. Type-level Unattempted is not an operator cell on this vehicle.

UX owns the exact not-kept sentence. Product owns that the sentence is not the miss literal, does not say the vendor file is absent, is not download-failed, and is not `present`.

## What I withdraw

- AC-15 breadth (reaffirm `7a05fb03…`): “Given D is due and the entitled class is not obtained, occupancy is **miss**.” Not-obtained after due is not automatically miss.
- The degraded-table fetch-fault row that classified vendor-down after due as miss.
- Closed product rule 4 clause “miss after if not obtained.”
- Any remaining defense of inspect-as-miss, including UX’s `75e92688…` exception “or inspect of a named due D with no stored object (BRIEF)” and UX AC-U17 applied to inspect of a due empty store with no proved 404.
- AC-23 listing `live-tape` and `live-paid-present` as distinguishable **outcomes of this vehicle**. They are distinguishable because they **do not appear** on keep / list / load of this corpus.
- S4 / `absent-is-not-none` wording that treated live tape and live paid present as members of this occupancy deck.

I do **not** withdraw: miss ≠ empty extract ≠ not-elapsed ≠ unreadable ≠ not-storing; `kept` as success occupancy; zero vendor on inspect; keep non-zero for a proved miss; the credential three-way split; per-class independence.

I do **not** settle session-bar aggregates In/Out, or whether this slice retains the universe gzip.

## Observables that remain

One observable apiece. A stranger can check them without reading source. Degraded cases are not footnotes on the happy path. `Verify by` is risk-based: automate where a silent collapse is plausible; review visible copy once UX names it. Not one-test-per-row. Prefer one hermetic matrix.

| # | Given / observable outcome | Verify by |
|---|---|---|
| **M1 (SB)** | Armed keep, weekday D due, files credentials present, store storing, files product answers 404 / no-such-key: occupancy is **miss**. Not empty extract, not not-elapsed, not not-storing, not download-failed, not not-kept, not a credential refuse. Keep command non-zero. Operator may retry after due. | test |
| **M2 (SB)** | Inspect / list / load of named due weekday D and an entitled class, no stored object for that identity, no proved 404 / no-such-key on this run: occupancy is **not-kept**. Files-product call count is 0. Outcome is not miss, not empty extract, not not-elapsed, not download-failed, not kept, not not-storing, not a credential refuse. Printed line does not say the vendor file is absent and is not UX’s miss literal. | test |
| **M3 (SB)** | Armed keep, D due, credentials present, store storing, files GET runs but does not confirm absence (vendor down, transport, non-404): occupancy is **download-failed** (`flat files download failed: vendor file for {ET_DATE} not confirmed`). Not miss, not kept, not empty extract, not not-kept inspect. Desk does not 5xx. | test |
| **M4 (SB)** | Inspect of a due identity that already reports miss from a prior proved keep 404 still shows **miss** with files-product call count 0. Inspect does not re-GET to “confirm.” | test |
| **M5 (SB)** | Vendor day file obtained and locked S has zero rows: **empty extract**. Not miss, not not-kept, not unreadable, not kept-with-history. | test |
| **M6 (SB)** | Clock before 11:00 ET on D+1, or a named ET date strictly after today ET: **not-elapsed**, no fetch. Not miss, not not-kept. | test |
| **M7 (SB)** | Stored artifact cannot load as reconstructable history: **unreadable**. Not miss, not empty extract, not not-kept, not not-storing. | test |
| **M8 (SB)** | Missing files pair, live REST key in the files slot, and HTTP token miss remain three distinct refuses. None print as miss. None print as not-kept inspect. Missing pair carries no REST-substitution clause (`67b8aeeb…`). | test |
| **M9 (SB)** | This vehicle’s keep / list / load print uses only the deck in Converged §2. Success occupancy word is **`kept`**, never `present`. | test |
| **M10 (SB)** | Poison: `live-tape`, `live-paid-present`, `present`, `live`, `live_massive`, and `Live tape` do **not** appear as this corpus’s occupancy. Tests fail if those literals appear here. Live tape / live paid present are distinguished by that absence, not by a cell on this vehicle. Coverage `missing` / `not yet due` / `blocked occupancy` likewise stay off this deck. | test |
| **M11 (SB)** | A universe-file miss proved on keep is **one day-file fact** inherited by the locked names — not three independent per-ticker vendor-file misses. A not-kept inspect of a due day with no stored object is likewise one day-file fact, not three ticker holes. | test |
| **M12 (SB)** | Per-class independence unchanged: a kept class does not rewrite a sibling. A sibling miss is only miss when 404 was proved for that class. A sibling never-kept after due is not-kept, not miss. | test |
| **M13** | Exact not-kept operator sentence (once UX names it) is not the miss literal, not download-failed, not `Unattempted` as a printed cell, and does not vouch vendor absence. | review |

**Method.** M1–M4 / M9–M10 are silent-honesty risks: a “helpful” inspect miss, a vendor-down labeled miss, or a `present` / `Live tape` cell would stay green under copy review. Automate those in the same occupancy matrix as AC-11–23, not a new harness per row. M13 is visible copy once the sentence exists.

**Ship-blocking:** M1–M12. M13 is the copy check that AC-53 already owned for standing text.

Synthesis replaces AC-15 and the inspect branch of UX AC-U17 with M1–M4; replaces AC-23’s outcome list with M9–M10. Do not rewrite R1 files.
}
