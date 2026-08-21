# session-chain-archive — R3 decisions

Source: `council/conflicts.json` (4 conflicts, quotes 4/4).

## Self-revisions (folded, no exchange)

- **Architect withdraws** the R1 restatement that three absence classes suffice.
  Quote: three closed classes (`no session book` ≠ empty/pruned ring ≠ store disabled-or-unreadable).
  **Locked:** four distinguishable research outcomes end-to-end:
  `no session book` ≠ `empty 48-ring` ≠ `session archive not storing` ≠ `session book unreadable`.
  Isolation table already split disabled vs corrupt; the “three” restatement is retired.

## Technical — settled (pm ↔ ux, one exchange, both `converged: true`)

1. **Four operator outcomes.** Withdraw “Three absences stay three strings.” Lock:
   `no session book` ≠ `empty 48-ring` ≠ `session archive not storing` (disabled/unavailable only) ≠
   `session book unreadable: <reason>` (identity present but unreadable only) — never interchangeable.
   §3 research-read framing still binds on the operator vehicle (including CLI stdout).
2. **AC-15 Verify by `test`.** Ship-blocking structural empty-diff / no new trader route affordance
   on `apps/dashboard` (no DOM harness). AC-19/20/21/22/23 stay **review**.

## Product — operator ruled (Grok TUI question card)

1. **Provenance mandatory.** Owner picked **A** (2026-08-19): every successful operator session-book
   read **must** show capture time (`source_as_of` / `archived from capture at <UTC>`). Identity
   stays `(symbol, et_date)` and is not that timestamp.
   First-wins + pre/post-RTH eligibility stand — the operator declined C (RTH-only). Queued
   “morning vs last-RTH” dissolves: they kept first-wins and required the time to be visible.


## Already aligned (no conflict)

- Sibling prune-proof archive; identity `(symbol, et_date)`; exactly one per day.
- First-wins named unless operator overrides (queued).
- `NO_UI_CHANGE`; no 48-cap raise, hist-chain, liquid-name force-capture, object-store.
- Path-B CLI rewrite out of this ship (existence + dedicated research list/load).
- Zero Massive on list/load; score-neutral blobs; desk-isolated writes.
