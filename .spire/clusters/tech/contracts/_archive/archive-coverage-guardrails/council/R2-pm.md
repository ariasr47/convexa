```json
{
  "role": "pm",
  "agree": [
    "**Winner: 10:00 ET.** Decisive axis: the BRIEF failure mode is prune-before-notice, not morning false-alarm.",
    "**Expected-identity rule (locked here):** for a chosen ET calendar date `D`, the expected set is the three `(s, D)` for `s in ENSURE_SYMBOLS` **minus** the seed identity, **iff** `D` is an ET weekday.",
    "It is a **sibling operator/research read** in the `_research` family.",
    "HTTP derive returns `NotYetDue` as a first-class status so a consumer cannot render pre-checkpoint as `Missing`.",
    "This is a hole. It is **not** `Missing` (row exists) and **not** `Unreadable` (body may deserialize).",
    "List-only is cheaper and **wrong**: index rows survive a deleted body (`store.rs` test: `load` is `Err`, not `None`).",
    "A **missing expected book** is runtime honesty, not a listener refusal — making it a startup fail would take trading down for the thing we are only trying to **see**.",
    "`[best-effort-isolated-or-null]`: coverage/warning/CLI failure **never** fails bundle, scan, SSE, or ensure.",
    "There is **no trader screen here.**",
    "SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table.",
    "`/_ops/metrics` gains **no** coverage matrix, coverage chip, or stage named from this feature.",
    "a CLI receipt printed on a laptop is **Evidence: local**.",
    "Vacuous / not-due window exits **0** and prints `[NOT DUE]… Not a coverage pass.` — never a PASS-all-present."
  ],
  "conflicts": [
    {
      "quote": "**Checkpoint = 16:00 America/New_York.**",
      "source": "pm",
      "why": "I cannot defend 16:00 against the BRIEF job. That hour is “session over,” not notice-before-prune: Massive is already open from 04:00 ET, and six more hours of 48-slot ring rotation is the silent-loss window this slice exists to beat. Not-yet-due already stops 00:01 false missing; that protection moves with the checkpoint and does not require waiting until RTH close.",
      "proposal": "Lock 10:00 America/New_York as the due instant. Keep not-yet-due, no hole warning, and no audit fail for today’s trio before that instant. Do not slide the clock to next midnight.",
      "kind": "product"
    },
    {
      "quote": "Every eligible date from the first ET weekday this environment’s session archive was **storing** through the last **due** date (yesterday, plus today once 16:00 ET has passed).",
      "source": "pm",
      "why": "An unbounded storing-window matrix is not the BRIEF job (same-ET-day hole, not a growing corpus report) and cannot ride architect’s worker path of three full-body loads per 60s tick. 21 Aug unset-root days are only false-missing if they sit in the default expected set; a today-default derive never asks for them. I will not silently keep AC-1 as a multi-month grid.",
      "proposal": "Default expected set is one ET date D (today, or the date the CLI names), minus the seed, iff D is an ET weekday. Last-readable may walk history (capped). Prior-day holes are audited by naming D, not by loading every due body on the worker. Pre-storing dates stay out of the default today matrix automatically.",
      "kind": "product"
    },
    {
      "quote": "Dispatch like `Capacity` (`main.rs` returns `ExitCode` before `run()`): **0** iff no hole among expected identities for the named date (default `today_et_date`); **non-zero** iff any expected identity is `Missing` | `Unreadable` | `RejectedSource` | `StoreDisabled`.",
      "source": "architect",
      "why": "The weekday expected set is not checkpoint-gated, so this exit rule makes a 09:00 ET audit of today non-zero whenever books have not landed yet. That is not-yet-due collapsed into a failed gate — the failure that trains operators to ignore the audit. HTTP already returns NotYetDue; a different CLI clock is two products. BRIEF requires the same matrix. UX already requires a not-due window to exit 0.",
      "proposal": "One derive for HTTP, CLI print, CLI exit, and warning suppression. CLI does not block until 10:00. Exit 0 when D is ineligible, not yet due, or every due expected identity is present. Exit non-zero on due Missing / Unreadable / RejectedSource, on store-not-storing, or on coverage-compute failure.",
      "kind": "product"
    },
    {
      "quote": "Walk `list(symbol, None)` newest-first (`MemoryInner::list` already sorts by `et_date` ascending).",
      "source": "architect",
      "why": "Newest-in-archive with no upper bound of D returns a later book when the CLI names a historical date. Last-readable on a D2 hole must be a present live paid identity on or before D2, or honest none — not a later date that reads as recovery.",
      "proposal": "Same walk, skip seed and non-live-paid, skip et_date > D, then the first readable LiveMassive; the 60-row cap still applies. Honest none if none qualify.",
      "kind": "technical"
    },
    {
      "quote": "Each due identity is exactly one of **present** · **missing** · **unreadable**.",
      "source": "pm",
      "why": "A fixture or reconstructed occupant of a live due identity is not missing (a row exists) and not unreadable (the body may deserialize). Forcing that occupant into one of those two classes is the collapse absent-is-not-none forbids. Architect’s RejectedSource is the honest split; AC-13 already requires not present.",
      "proposal": "Due cells are present, missing, unreadable, or a distinct not-present-wrong-source outcome. It fails the audit, emits one warning after checkpoint, and is distinguishable from the other three. UX names the operator literal. Seed identity exclusion is unchanged.",
      "kind": "technical"
    },
    {
      "quote": "6. **Hole list** — only `missing` and `unreadable` identities; empty hole list is not the same as “ineligible window.”",
      "source": "ux",
      "why": "RejectedSource fails the audit and is neither missing nor unreadable. Omitting it from the hole list yields empty holes plus non-zero exit — the copy bug UX already forbids (print, hole list, and exit must agree). Reusing missing or unreadable wording is the same class collapse.",
      "proposal": "Hole list names every identity that fails the due audit except matrix-level errors (not-storing, compute-fail). Add a closed operator literal for wrong-source occupancy; do not print present; do not reuse missing or unreadable. One S2 warning after checkpoint for that identity.",
      "kind": "technical"
    }
  ],
  "asks": [
    "UX: what closed cell literal and S2 warning line should the operator see for a fixture or reconstructed occupant of a due identity (architect RejectedSource) so it is not present, not missing, and not unreadable?",
    "Architect: when the CLI names a weekday D from before this environment was storing, can coverage distinguish that date from missing, or is pre-storing-vs-missing an accepted residual on the named-date path only?",
    "UX: on a weekend named D, is the operator surface three ineligible rows (architect) or omitted date columns plus [NOT DUE] with no cells? Product only requires weekend ≠ missing, ≠ warn, ≠ non-zero."
  ]
}
```
