```json
{
  "role": "ux",
  "pair": "architect",
  "resolutions": [
    {
      "conflict_id": "f2c07fc3a4817a363d7ff024bb3e07172de9e1785ad0264973de74b180ec0c3f",
      "converged": true,
      "ruling": "Weekend D (today_et_date or CLI-named Saturday/Sunday) is state not-due/ineligible-window, not a classified coverage matrix. D2 already withholds expected-date columns. Operator sees the standing block (that D · Checkpoint: after 16:00 America/New_York) then `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.` Exit 0. No date columns. No classified cells. Do not print `ineligible`, `IneligibleWeekend`, `present`, `missing`, `unreadable`, or `not yet due` as cells. Do not print `[PASS]`, `n/n present`, or last-readable as if a pass ran. Module type IneligibleWeekend may exist internally; it is not an operator cell literal. Empty-all-missing remains forbidden. Closed operator cells stay only present | missing | unreadable | not yet due — none of them apply on weekend D."
    },
    {
      "conflict_id": "e3daa5de5be881b01a0994ae1e02411b99fa4abdf60ac8ddb134e029239c7b34",
      "converged": true,
      "ruling": "StoreDisabled is state error-not-storing, not a hole and not in the missing/unreadable/blocked-occupancy family. Operator sees the matrix withheld and `[ERROR] archive-coverage — session archive not storing. No pass recorded.` Exit non-zero. No `session archive coverage warning` line. No three per-symbol keys. No fabricated present/missing/unreadable/not-yet-due cells. A distinct store-disabled log is allowed only if it does not reuse the missing, unreadable, or blocked-occupancy warning templates. Disabled on a weekend is still this ERROR — never renamed `[NOT DUE]` or all-missing. Print, withheld matrix, and non-zero exit agree."
    },
    {
      "conflict_id": "be05e5364572cfccd898ecc66c7226cb38880d1f7dc72294c8f4100d73911c72",
      "converged": true,
      "ruling": "The 60-row walk may stay as an I/O bound; the copy may not treat a stopped walk as vouched absence. Last-readable is a trailing per-symbol line for evaluated D, never a coverage cell (never present|missing|unreadable|not yet due). Operator sees exactly one of: (1) `last readable: {SYMBOL} {ET_DATE}` only for a vouched Present LiveMassive identity with et_date on or before D, seed excluded — never a later date than D, never another symbol, never silent seed; (2) `last readable: none (seed fixture excluded)` only when this run finished the walk without hitting the cap and found no qualifying present; (3) `last readable: undetermined (walk cap)` when the walk hits the cap with no qualifying present — do not print `none (seed fixture excluded)`, do not print a date. Weekend and StoreDisabled withhold last-readable (no fake pass artifact)."
    },
    {
      "conflict_id": "931c6dfca587cda3c69cdd4a8d3822920831fc0f644479e8fea2c2af4fcd136e",
      "converged": true,
      "ruling": "Derive arm RejectedSource stays internal. Closed coverage cells remain only present | missing | unreadable | not yet due. Wrong-source occupancy is not one of those four and never `live_massive`. Operator identity mark (matrix cell, not a fifth coverage class): `blocked occupancy`. Identity line (hole list / fail list): `{SYMBOL} {ET_DATE} blocked occupancy — occupant is not a live paid session book`. After 16:00 America/New_York on a due weekday, exactly one S2 line: `session archive coverage warning — blocked occupancy {SYMBOL} {ET_DATE} (not a live paid session book)` — does not reuse the missing or unreadable templates, not a permission-denied flood. Four-class counts do not absorb this identity as present, missing, unreadable, or not yet due. Do not print `RejectedSource`, `Fixture`, `present`, or `live_massive`."
    },
    {
      "conflict_id": "4d21ed8a57e2ecd5753c8660896dcd4abb9a1c66d25de47802b225b65dfed8b6",
      "converged": true,
      "ruling": "UX retracts AC-U13’s iff missing|unreadable. Exit 0 only when every due expected identity is `present`, or when zero identities are due. Vacuous/not-due: weekend `[NOT DUE]… Not a coverage pass.` (f2c07fc3) or pre-checkpoint today cells `not yet due` (5745ca17) — never `[PASS] n/n present`. Exit non-zero and distinguishable: `[FAIL] archive-coverage — {h} due expected identities missing, unreadable, or blocked occupancy.` when any due identity is missing, unreadable, or blocked occupancy; `[ERROR] archive-coverage — session archive not storing. No pass recorded.` on StoreDisabled; `[ERROR]… No pass recorded.` on derive/store fault. Print, hole list, and exit agree. PASS remains `[PASS] archive-coverage — {n}/{n} expected present · 0 missing · 0 unreadable · 0 Massive calls · local audit is not production coverage` only when n≥1 identities were due and all present (blocked occupancy cannot hide behind that line)."
    },
    {
      "conflict_id": "5745ca174324309f40c56b0694884834ed4c34ee546f22147f3e21d1fa4333e6",
      "converged": true,
      "ruling": "Closed by D1. CLI does not sleep. HTTP print, CLI print, CLI exit, and warning suppression share one derive. Before 16:00 America/New_York on an ET weekday D=today, each of SPY/QQQ/IWM is cell `not yet due` — not `missing`, not a hole-list entry, no S2, those cells do not fail the process. Standing block prints Checkpoint: after 16:00 America/New_York. Weekend remains `[NOT DUE]` with no cells (f2c07fc3), not three `not yet due` cells. Not-yet-due is not a hole."
    }
  ]
}
```
