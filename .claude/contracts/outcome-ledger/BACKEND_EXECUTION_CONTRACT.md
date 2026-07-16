# outcome-ledger — BACKEND_EXECUTION_CONTRACT

> Binds to `.claude/contracts/outcome-ledger/INTERFACE_CONTRACT.md`.
> Self-contained against `.claude/PROJECT_CONTEXT.md` — assume no chat history.

---

## Verdict: **`NO_BACKEND_CHANGE` — there is no backend work in this feature.**

**The `apps/api` diff MUST be empty. No backend lane spawns. Do not invent server work.**

Per `INTERFACE_CONTRACT.md`, this feature has **no FE↔BE surface at all**. The whole feature is a
client-local derived read over durable stores that already exist, plus a client-local archive file.

---

## The complete backend deliverable

**Nothing.** Explicitly, this feature adds:

- **no endpoint** (and changes none)
- **no request field, no query param, no response field**
- **nothing on SSE**
- **no server store, no table, no migration, no account-scoped state**
- **no dependency**
- **no config / env var**
- **no change to `signals.py`, the entry gate, `opportunity_score`, `opportunity_tier`, or
  `state_fingerprint`** — they stay **byte-identical**

---

## Why this is the design, not a deferral

The empty diff is **the feature's central structural guarantee**, not an absence of work:

> **A statistic that never leaves the browser cannot reach `signals.py`.**

`[additive-keeps-score-byte-identical]` (HARD) + `[score-change-is-deliberate-and-measured]` require that
this feature can **never** auto-tune the score. The `ARCHITECTURE_CONTRACT` §5.1 enforces that with four
structural boundaries, of which **boundary 1 is "ZERO backend surface"**. A per-user server outcome store
would have crossed `[server-side-gate-enforcement]` and would have hijacked the already-named
OPEN_THREADS §7f seam (migrating **all ~5** durable stores together, deliberately). The durability cost is
paid **in-scope, client-side** instead — via the archive (export + a merge-only, never-destructive
import), which is a **frontend** deliverable.

`apps/api/src/marketdata/` was rejected as a home by decision: it is a **ticker-keyed, non-user,
non-secret, anonymous-readable MARKET-data** side store. Per-user trading history there would be a
**category error** — creating a per-user server store *without* the account/session/isolation discipline
that `src/auth/` exists to provide. (`ARCHITECTURE_CONTRACT` §2/Q1.)

---

## Named seams — do NOT build them here

- **A per-user, account-scoped server outcome store + multi-device sync** — `ARCHITECTURE_CONTRACT` §8
  non-goal 4 / OPEN_THREADS §7f. It must carry all ~5 durable stores **together with the gate**, as its
  own deliberate feature.
- **A real server gate on the archive import** — the honest options were a real server gate (which
  requires the server store this feature declines) or **none**; **none** is the decision
  (`PRODUCT_CONTRACT` §4.13). An FE-only gate is forbidden as decorative.
- **A `scoring_basis_version`** — it does not exist yet. When a score-changing feature lands, the version
  belongs in the capture digest and the ledger must partition by it. §8 non-goal 14.
- **Feeding a digest of the ledger to the AI** — a separate feature, governed by
  `[digested-labels-not-raw-dump]`. §5.1 boundary 4 forbids it in v1.

---

## Verification (GATE Q)

1. **`apps/api` diff is empty** — the whole backend AC.
2. **Score byte-identity** — `opportunity_score` / `opportunity_tier` / `state_fingerprint` unchanged
   (trivially satisfied: nothing was touched).
3. **No `interface_conformance.py` run applies** — there is no backend surface to verify, and
   `INTERFACE_CONTRACT.md` emits no `## Conformance spec` block by decision. *(A `contract_lint.py` WARN
   about the missing block is **expected and correct** here — do not "fix" it by fabricating an
   endpoint.)*
