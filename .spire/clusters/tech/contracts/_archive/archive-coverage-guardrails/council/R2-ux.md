```json
{
  "role": "ux",
  "agree": [
    "It is a **sibling operator/research read** in the `_research` family.",
    "A hole is **data**, not a trader 5xx.",
    "It is **not** `Missing` (row exists) and **not** `Unreadable` (body may deserialize).",
    "Folding it to `Present` is the reconstruction lie the BRIEF forbids.",
    "No trader UI, AppShell link, or bundle field.",
    "A local audit receipt is **not** production coverage.",
    "HTTP derive returns `NotYetDue` as a first-class status so a consumer cannot render pre-checkpoint as `Missing`.",
    "for a chosen ET calendar date `D`, the expected set is the three `(s, D)` for `s in ENSURE_SYMBOLS` **minus** the seed identity, **iff** `D` is an ET weekday.",
    "No in-app trader surface this round.",
    "Coverage never fetches, fills, or writes."
  ],
  "conflicts": [
    {
      "quote": "Given a storing archive and at least one due ET weekday, the operator matrix includes each of SPY, QQQ, and IWM for every due expected date in the storing window, and each of those cells is classified exactly one of present, missing, or unreadable.",
      "source": "pm",
      "why": "BRIEF observed-by is the same ET day's trio, not every weekday since this environment began storing. A storing-window grid makes Saturday still due on last Friday, so UX `[NOT DUE]` for weekend-only today cannot stand; it invites 7/9-style count headlines this lane banned as health; and first-boot would warn every historical hole — a new flood. Architect already locked one evaluated `D`. Pre-storing dates must still never print as `missing`; that honesty does not require emitting the whole history as the default matrix. I retract any reading of my three-date layout example as a locked window — it was illustration only.",
      "proposal": "Default S1/S3 matrix and S2 latch evaluate one ET date `D` (today, or CLI-named). Weekend `D` → `[NOT DUE]`, no expected date columns, exit 0. Standing block prints that `D` plus the locked checkpoint. Forensic history is a re-run with a named date, not v1 columns. A named weekday from before this archive was storing is not `missing` (not expected / blocked), not a hole warning.",
      "kind": "product"
    },
    {
      "quote": "Each due identity is exactly one of **present** · **missing** · **unreadable**.",
      "source": "pm",
      "why": "Architect's first-wins fixture occupancy is a due outcome that is not `present` (not LiveMassive), not `missing` (row exists), and not `unreadable` (body may deserialize). Folding it into those three tokens is a silent rename — this lane's defining failure. UX R1's closed cell set and AC-U13 (non-zero iff missing or unreadable) were also too narrow; I retract the iff. Exit 0 only when every due expected identity is `present`. Warnings that fire only for missing/unreadable leave fixture occupancy silent.",
      "proposal": "Keep derive `RejectedSource`. Operator-visible due cell for fixture/reconstructed occupancy is not `present`, not `missing`, not `unreadable`, and never `live_massive`. CLI non-zero. After checkpoint, exactly one structured warning whose line does not reuse the missing or unreadable templates. Prefer blocked/error for that identity over a pretty fourth synonym that still looks like a coverage class.",
      "kind": "technical"
    },
    {
      "quote": "CLI **does not wait** for checkpoint: the operator asked *now*.",
      "source": "architect",
      "why": "If *now* means today's empty archive is `missing` and the process exits non-zero before the checkpoint, CLI silently renames `not yet due` as a hole. The next sentence already returns `NotYetDue` on HTTP. Split vehicles that disagree on the cell literal violate same-matrix copy. Morning FAIL trains operators to ignore the gate. Architect's assumption that PM will keep CLI evaluation checkpoint-free cannot stand as pre-checkpoint `missing`.",
      "proposal": "CLI does not sleep until the checkpoint. It still prints `not yet due` for today's eligible cells before that instant, omits them from the hole list, and does not fail the process for those cells. Same derive as HTTP.",
      "kind": "technical"
    },
    {
      "quote": "**Matrix:** always three symbol rows for the evaluated `D` (weekend → three `IneligibleWeekend` rows, not an empty “all missing” list).",
      "source": "architect",
      "why": "Three `ineligible` cells are a coverage matrix that classified nothing expected. Closed operator cell literals are `present` | `missing` | `unreadable` | `not yet due`. `IneligibleWeekend` as a module type is fine; printing it as a cell will be read as a coverage class and screenshotted as a run. The operator signal for weekend `D` is `[NOT DUE]… Not a coverage pass.`, not three classified rows.",
      "proposal": "Weekend `D`: withhold expected date columns; print the NOT DUE verdict; exit 0. Do not emit `ineligible` as a matrix cell. Empty-all-missing is still forbidden — standing + NOT DUE is the distinct state.",
      "kind": "technical"
    },
    {
      "quote": "After checkpoint on a weekday: `Missing` / `Unreadable` / `RejectedSource` / `StoreDisabled` are holes.",
      "source": "architect",
      "why": "`session archive not storing` is a matrix-level error, not a hole in an expected book. Treating StoreDisabled as the same hole family as missing/unreadable — even with one process-level key — puts a coverage-warning identity in the grep stream for a lost book when no identity was expected. UX withholds the matrix, prints `[ERROR]… session archive not storing. No pass recorded.`, exit non-zero, no S2 coverage warning.",
      "proposal": "StoreDisabled → error state (matrix withheld, CLI `[ERROR]` non-zero, no `session archive coverage warning` line). A distinct store-disabled log is allowed; it must not use the missing/unreadable warning templates or three per-symbol keys. Exit non-zero stands.",
      "kind": "technical"
    },
    {
      "quote": "**Cap the walk at 60 index rows** so a fully corrupt archive cannot turn a coverage pass into unbounded body reads.",
      "source": "architect",
      "why": "`last readable: none (seed fixture excluded)` is allowed only when this run can vouch there is no non-seed present identity. Stopping at 60 unreadables and printing `none` fabricates that absence. Bounded I/O can stay; the copy cannot.",
      "proposal": "Cap may remain as an I/O bound. If the walk hits the cap without a qualifying present identity, do not print `none (seed fixture excluded)` and do not print a date. Omit last-readable or mark it undetermined/blocked. Never silent seed.",
      "kind": "technical"
    },
    {
      "quote": "**`review` owns** command discoverability/naming (AC-20), absence of trader UI (AC-29), and non-absorption of tape/object-store/monitor/volume (AC-35).",
      "source": "pm",
      "why": "Trader-chrome absence can silently regress (toast, Ask-AI line, `/_ops/metrics` card, Pages proxy) without a named new screen. Review of no screen added will not catch it. UX AC-U1–U4 mark those `test` (structural empty-diff, Pages 404, OperatorMetrics closed stage set).",
      "proposal": "AC-20 naming and AC-35 non-absorption stay `review`. Trader-silence and `/_ops/metrics` non-render stay `test` (UX AC-U1–U4). AC-29 may remain `review` only as we did not choose a dashboard route; it does not replace those test marks.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Human: lock 10:00 vs 16:00 America/New_York so the standing block can print `{locked ET checkpoint}` without inventing it. UX copy works with either; the latch-once warning can assert `missing` after the book later lands — worse at 10:00, still true at 16:00.",
    "Architect: operator-facing token and exact warning line for `RejectedSource` (must not reuse missing, unreadable, present, or `live_massive`).",
    "Architect: how a CLI-named weekday from before this archive was storing is distinguished from `missing` without shipping PM's full storing-window grid.",
    "PM: if the storing-window grid is withdrawn, confirm last-readable is per-symbol when-any for evaluated `D` (BRIEF), not per historical row on-or-before that row's date."
  ]
}
```
