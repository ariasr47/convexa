```json
{
  "role": "architect",
  "pair": "ux",
  "resolutions": [
    {
      "conflict_id": "f2c07fc3a4817a363d7ff024bb3e07172de9e1785ad0264973de74b180ec0c3f",
      "converged": true,
      "ruling": "I withdraw printing three IneligibleWeekend operator cells. Owner D2 already locked weekend D as not a coverage pass. Mechanism: is_et_weekday(D) false (same ensure.rs Mon–Fri America/New_York rule) yields an empty expected set; derive does not materialize (SPY|QQQ|IWM, D) cells; the printer withholds expected date columns; the standing block still names that D and the locked 16:00 America/New_York checkpoint; the verdict is [NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.; CLI exit 0; no S2; no hole list. Module type IneligibleWeekend remains for exhaustive match so a weekend date can never classify as Missing. Empty-all-missing and [PASS] n/n present stay forbidden — standing plus NOT DUE is the distinct state."
    },
    {
      "conflict_id": "e3daa5de5be881b01a0994ae1e02411b99fa4abdf60ac8ddb134e029239c7b34",
      "converged": true,
      "ruling": "I withdraw treating StoreDisabled as a hole-family member. Mechanism: if SessionChainArchive is Disabled or list/load returns Err whose text is session archive not storing, derive short-circuits before per-symbol classification and last-readable walks; the matrix is withheld (zero cells, not three missing/blocked rows); CLI prints [ERROR] archive-coverage — session archive not storing. No pass recorded. and exits non-zero; HTTP is the same store-disabled error, not a missing grid. The warning emitter does not insert EnsureGate::td_key coverage keys and does not emit a session archive coverage warning line. A distinct store-disabled log is allowed (boot already uses that string) but must not reuse the missing, unreadable, or blocked templates and must not mint three per-symbol keys. Exit non-zero stands; it is the [ERROR] path, not [FAIL] holes."
    },
    {
      "conflict_id": "be05e5364572cfccd898ecc66c7226cb38880d1f7dc72294c8f4100d73911c72",
      "converged": true,
      "ruling": "The 60-row bound stays as I/O, not as a license to print none. Mechanism: list(symbol, None) returns metas; seed and non-LiveMassive rows are skipped without load and do not consume the cap; the cap counts load+deserialize_capture attempts on remaining LiveMassive candidates and stops at 60. Last-readable is a three-arm type: Found(et_date, source_as_of) when a readable LiveMassive qualifies; None only when those candidates are exhausted with no Found (operator may then print last readable: none (seed fixture excluded)); Undetermined when the 60th load completes without Found and unexamined LiveMassive candidates remain. On Undetermined the printer must not print none (seed fixture excluded), must not print a date, and must not silently use the seed — omit the value or mark undetermined (not the RejectedSource blocked token). Hitting the cap is not itself a CLI hole."
    },
    {
      "conflict_id": "931c6dfca587cda3c69cdd4a8d3822920831fc0f644479e8fea2c2af4fcd136e",
      "converged": true,
      "ruling": "Derive keeps RejectedSource as a distinct arm: load Ok(Some) whose meta.source is not LiveMassive (today Fixture; exhaustive match on MarketDataSourceKind so a new kind cannot become Present). That identity is not present, not missing (an index row exists), not unreadable (the body may deserialize), and is never labeled live_massive on this matrix. Operator-visible cell token is UX’s blocked family: blocked — not a fourth coverage-class synonym. Hole list line is {SYMBOL} {ET_DATE} blocked. After the D1 16:00 America/New_York checkpoint on a due weekday, the latch (process Mutex<HashSet> keyed by EnsureGate::td_key(symbol, et_date)) emits exactly one structured line session archive coverage warning — blocked expected book {SYMBOL} {ET_DATE} and inserts the key; that line must not reuse the missing or unreadable templates, must not say present, and must not say live_massive. No warn before checkpoint, on weekend, on the seed, or on StoreDisabled. insert_if_absent first-wins cannot self-heal in this slice; coverage only names the occupancy."
    },
    {
      "conflict_id": "4d21ed8a57e2ecd5753c8660896dcd4abb9a1c66d25de47802b225b65dfed8b6",
      "converged": true,
      "ruling": "UX’s AC-U13 iff missing|unreadable is retracted; I fold that retract. Mechanism: archive-coverage returns ExitCode like Capacity (before run()). Exit 0 when the expected set is empty (weekend NOT DUE) or every due expected identity is Present — including the pre-checkpoint case where today’s non-present cells are NotYetDue and do not fail the process. Exit non-zero when any due identity is Missing, Unreadable, or RejectedSource (blocked). StoreDisabled and derive/store/vendor-path faults stay the distinct [ERROR] non-zero path, not aliases of [FAIL]. The FAIL verdict, hole list, and exit must include blocked identities so empty-holes-plus-nonzero cannot happen; closest FAIL line the synthesizer can fold is [FAIL] archive-coverage — {h} expected identities missing, unreadable, or blocked. Structural poison: insert Fixture on a due weekday → status ≠ Present → CLI ≠ 0."
    },
    {
      "conflict_id": "5745ca174324309f40c56b0694884834ed4c34ee546f22147f3e21d1fa4333e6",
      "converged": true,
      "ruling": "Owner D1 already closed this; I do not relitigate the clock. Mechanism: HTTP adapter, CLI print, CLI exit, and warning suppression all call one derive(now, D). CLI does not sleep, wait, or poll until 16:00 America/New_York. On an ET weekday before that instant, today’s Missing / Unreadable / RejectedSource cells print not yet due, are omitted from the hole list, emit no S2, and do not fail the process; a book that already loaded as Present may still print present. Named D is classified due vs not-yet-due against the same injected now (a past weekday is already due). Weekend D uses the NOT DUE path, not three not-yet-due cells."
    }
  ]
}
```
