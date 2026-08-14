# RESUME — branch `main` — written 2026-08-13 (GATE PLAN closed, pre-fan-out)

Conductor snapshot at a clean gateway boundary: **`ai-rec-grounding` GATE PLAN closed; both build
lanes NOT yet dispatched.** Overlay on the canon — reconcile against disk. Supersedes the
2026-08-13 post-ship snapshot (that feature, `tradeable-rec-inputs`, is shipped + archived).

## Where we are

**`ai-rec-grounding` is in flight**, at `.spire/clusters/tech/contracts/ai-rec-grounding/`.
GATE I → GATE C → GATE PLAN all closed this session. Nothing has been built yet; **no source file
has been touched.**

- **GATE I (2026-08-13):** chose `ai-rec-grounding` from 14 candidates. Every number the AI rec
  asserts must trace to a Convexa-computed value. BACKLOG carries the record + full cull.
- **GATE C:** R1 ×3 blind → R2 ×3 (28 conflicts, **28/28 quotes machine-verified**, 5 self-revisions)
  → R3 one exchange (**19/19 technical converged or conceded, none promoted**; 8 of 9 product
  conflicts closed by convergence) → owner ruled D7 → R4 ×2 → S2 ×2 (pass 1: 1 Critical + 8 Important
  + 3 Minor; pass 2 **PASS**). `SPEC.md` (~950 lines) + `INTERFACE_CONTRACT.md` **owner-approved**.
- **GATE PLAN:** `PLAN.md` — **48 items**: B1–B16 · F1–F17 · V1–V15. Critical path
  `B1→B2→B6→…→B16→V3`. Global Constraints carry the conformance block **verbatim**.
- **GATE Z (raised by the planner, both resolved):** Z1 AC-7 contradicted shipped behaviour; Z2
  named a non-existent export artifact. See `SYNTHESIZER_AMENDMENTS_REQUESTED.md`.
- `contract_lint ai-rec-grounding` → **0 errors** (3 warnings are pre-existing PROJECT_CONTEXT
  shard sizes, not this feature). Ledger: **7 rows**, all gate C, incl. the **first instance** of
  `ai-asserted-numbers-are-traceable`.

## Next concrete step

**1. Apply the D8 ruling (one arm, one string) BEFORE dispatching lanes.** Recorded in
`council/decisions.md` §D8. The block-absent prefill branch has no reason literal; SPEC §4's table
has only two. Add a **third** literal in the card's `wasn't checked` register, distinct from both
existing ones. Touches: SPEC §4 table + AC-68's disjointness check; PLAN F3 (literal), F4
(`prefillGate` arm), F16 (render), F17 arm 4 (assert the reason, not just no-seed). **Block-absent
still never licences a pre-fill** — this adds an explanation, never a seed. Owner may flip it to
silence by saying `silence`.

**2. Then dispatch both build lanes in parallel** (`spire-tech-backend` on B-items,
`spire-tech-frontend` on F-items), both bound to `INTERFACE_CONTRACT.md`. → GATE Q → GATE S.

## Owner-facing, unanswered

- **F12 is BLOCKED on the owner** appending the **type-register Amendment** (mono = Convexa computed,
  sans = model asserted) to `DESIGN_SYSTEM.md` §Amendments. The lane checks and **stops** rather than
  inventing canon. Everything else can proceed around it.
- **AI key rotation still advised** (carried from the last snapshot — a shell one-liner echoed the key
  into a local tool log during V10; never committed, sweep clean). Owner's call.
- Declared under default-with-veto this session, both reversible: **D8** (third literal, above) and
  **Z1 Reading A** — clicking *Act* on a rec whose stop did not trace brings that field up **empty**
  with a reason instead of pre-filled. Say `keep prefill` to reverse Z1.

## Standing facts (verified this session — do not re-derive)

1. **The BRIEF's original evidence path was STALE and R1 caught it.** `ScenarioLLMProvider` /
   `AI_REC_SCENARIOS_ENABLED` **do not exist in the Rust backend** — `recommendation.rs:358`
   hardcodes them off, `scenario_id` (`:803`) is deserialized and never read, the FE picker
   (`AiRecPanel.tsx:275`) is dead code. Inherited from the **Python-era** 2026-07-16 backlog entry.
   Replaced by fixtures through `envelope_extras` + an `AI_REC_LOCAL_ONLY=1` live arm — which
   **DOES require a usable key** (`recommendation.rs:655` gates on `resolved.usable()`).
2. **Scope is honestly smaller than the BRIEF's headline** (SPEC §1 says so in one sentence):
   `max_risk` and `position_size` are **structurally not-checkable in v1**. Real coverage = stop ·
   target · invalidation · cited contract. The cap-anchored shortcut was withdrawn at R3 — a
   fabricated $480 under a $500 cap would have rendered "traced".
3. **A borrow trap the planner named:** `pruned_market_state` is *moved* into `RecPromptContext` at
   `recommendation.rs:681`, **after** the `base` closure at `:617`. B10 extracts a `Copy`
   `GroundingAnchors` before the closure and hoists `local_only`.
4. **:8000 orphan** (PID 58588, `taskkill /F` access-denied) serves stale code and rewrites
   `data/scan.json` several times a minute — **verify on :8010+**; a naive before/after byte check on
   that file gives a false failure. `ports:free` is **IPv4-only**; Vite binds IPv6 (`localhost:`,
   not `127.0.0.1`).
5. **NEVER `git stash`** while another lane/conductor holds uncommitted work — it destroyed the
   conductor's planning surface on the last feature. Targeted `git checkout -- <file>` or a worktree.
6. **A green `nx test` does NOT mean the types are sound.** `npx nx typecheck` and
   `cargo check -p api-rust --features postgres` are separate mandatory steps. **Check EXIT CODES,
   not printed summaries.**
7. **Dashboard suite baseline: 1639 passing + 5 accepted pre-existing red files** (`readonly.spec.tsx`,
   `positions.risk.spec.tsx`, `grouping.integration.spec.tsx`, `stage3-amber.spec.ts`,
   `orders.risk.spec.tsx`). A **6th** red file is a new regression.
8. **CI/CD exists and push = deploy** (Railway auto-deploy + CF Pages git builds + `deploy-smoke.yml`).
   Standing-red CI is pre-existing, not ours — BACKLOG §B `ci-standing-red`.

## Two residuals booked OPEN in SPEC §9 — do not let a lane close them falsely

- **§9.5 halo effect** — a reader could still generalize "no marker = checked" from the fields that
  carry a clause. Mitigated by an allowlist tooltip + the four cut fields carrying **no** marker at
  all; reviewed, never measured against a real reader. Closes when `rec-absence-literals-hole` ships.
- **§9.6 no-key verification gap** — with no provider key, layer-2 records **not-run with its reason**.
  V10–V13 are key-gated. **Never a synthesized run** (the `tradeable-rec-inputs` V10 precedent).
- **§9.7** — no export surface carries the strategy, grounding states or system prompt; widening was
  ruled out (`egress-copy-tracks-payload`). **AC-5's export half is vacuously true — do not chase it.**

## D7 (owner-ruled) — the noise bar is a MEASUREMENT, not a ship gate

Ladder **pre-committed before the split is seen**: ≥5 real recs across ≥3 tickers, record the
traced / no-match / couldn't-check split into a committed artifact; high no-match ⇒ **one** prompt
revision + **one** re-run ⇒ still high ⇒ ship with the honest rate recorded. **Never a tolerance
widening, never a scope cut, never a synthesized run.** Still ship-blocking regardless: **AC-33**
(a fabricated-rec fixture must trip the check) and **AC-50** (poison-proved non-vacuous, via §2.6
guard 8 asserted through `envelope_extras` with four poison arms).

## Backlog items this session created

- **`rec-absence-literals-hole`** — 4 rec fields (`Structure`, `Strike(s)`, `Expiration`,
  `Entry trigger`) print an out-of-set bare `—` on `main`. Pre-existing `absent-is-not-none` defect;
  this feature neither creates nor worsens it, and deliberately attaches **no** grounding marker there.
- **PROJECT_CONTEXT shard sizes** — §2 (178) / §5 (211) / §6 (530 lines) exceed the threshold, so any
  feature tagging into them loads the whole section. This feature's pack went 971→441 lines only after
  dropping the `personas` tag (which is the tag on §6).
