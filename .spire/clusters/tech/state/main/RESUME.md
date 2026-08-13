# RESUME — branch `main` — written 2026-08-13 (post-ship snapshot)

Conductor snapshot at a clean gateway boundary: **`tradeable-rec-inputs` GATE S closed; GATE I not
yet run.** Overlay on the canon — reconcile against disk.

## Where we are

**Nothing is in flight.** `contracts/` holds only `_archive/`. `tradeable-rec-inputs` SHIPPED +
ARCHIVED 2026-08-13: full pipeline (GATE I 2026-08-12 → council 22/22 conflicts + 1 owner ruling →
S2 FAIL→fix→PASS → PLAN B1–B18/F1–F13/V0–V11 → parallel lanes → GATE Q 93/7 → GATE Z → 100/100
PASS, 13/13 ship-blocking). Conformance spec promoted to
`state/conformance/tradeable-rec-inputs.json` (4 endpoints). Canon folded: OPEN_THREADS §7ad +
PROJECT_CONTEXT §6 + BACKLOG (GATE I record + §C ship note + §E stash-trap entry). Ledger: 8 rows
(6 C + 2 Q); `ledger_tally` → **no graduations**; new watch key `egress-copy-tracks-payload` (1).
CLAUDE.md gained two trap entries (git-stash-destroys-sibling-work; stale tsc --build outputs).

## Next concrete step

GATE I (Discovery) on "go". Pre-registered from the 2026-08-13 ship, re-test rather than inherit:
- **`ai-rec-grounding`** — strongest successor; strictly MORE valuable post-ship (the rec now
  asserts candidate-sourced numbers to trace). BACKLOG §B.
- **`score-lab-b0b-outcomes`** — S-sized backend fast-path; needs `MASSIVE_API_KEY` at run time.
- **`rec-prompt-single-figure-max-risk`** — S; the model's `max_risk` prose names two figures in
  one sentence → `cap_check: not_checkable` on 4/4 after-arm trades. Prompt tweak, never a parser
  loosening. Recorded in §7ad deferred seams.
- **V7 evening quote-fill** — owner/conductor chore, not a feature: run the shipped harness once in
  a 20:00–23:00 ET window; pre-committed response ladder in the archived SPEC §7.

## Standing facts (verified this session — do not re-derive)

1. Backend Rust (`apps/api`, Axum/Tokio, crate `api-rust`); `cargo check -p api-rust --features
   postgres` separate mandatory step; exit codes not summaries; `npm run typecheck` separate.
2. **:8000 orphan** (PID 58588, unkillable) serves stale code + rewrites `data/scan.json` — verify
   on :8010+. `ports:free` is IPv4-only; Vite binds IPv6 (`localhost:`, not `127.0.0.1`).
3. **NEVER `git stash` while another lane/conductor holds uncommitted work** — destroyed the
   conductor's planning-surface edits this feature (rewritten from context; CLAUDE.md trap added).
4. **Owner should rotate the AI key** — one shell one-liner echoed it into a local tool log during
   V10 diagnosis (never committed; sweep clean). Advised, owner's call.
5. **N1 (deploy) still outstanding — 5 consecutive gate flags.** `convexa.pages.dev` serves the
   2026-06-29 build; the signups-closed lockdown is NOT live. Owner habit; will not fix itself.
6. Dashboard suite baseline: 1639 passing + 5 accepted pre-existing red files (`readonly.spec.tsx`,
   `positions.risk.spec.tsx` network-pattern, `grouping.integration.spec.tsx`, `stage3-amber.spec.ts`,
   `orders.risk.spec.tsx` tail network sweep). A 6th red = new regression.

## The lessons this ship added (ledger rows exist — apply, don't rediscover)

- Wired-to-the-wire is not rendered: six FE surfaces consumed contract fields yet never displayed
  them; only runtime observation caught it.
- A guard asserting only negatives passes over an EMPTY surface — assert the POSITIVE at rendered
  scope, poison-prove every new guard.
- A measurement that cannot run records unavailability as a finding, never a synthesized result
  (the V10 no-key first attempt is preserved in the archived artifact as the exemplar).

## Owner-facing, unanswered

None blocking. Key rotation advised (item 4). Escalation trigger never fired this feature.
