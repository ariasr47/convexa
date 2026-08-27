# archive-coverage-guardrails — R3 decisions

Source: `council/conflicts.json` (10 conflicts, quotes 10/10).

## Product — operator ruled

1. **Shared offline market calendar.** Owner picked **A** (2026-08-26): expected sessions exclude
   Saturdays, Sundays, and recognized full-day US market holidays. One zero-vendor eligibility
   mechanism must drive both the ensure producer and coverage detector, so they cannot disagree.
   This folds `c90f0ab…`, `10b3aa28…`, and `9c89b57e…`.
2. **One warning per identity per process run.** Owner picked **A**: warning suppression keys only
   `(symbol, ET date)`. A later missing↔unreadable classification change updates metrics/audit output
   without another warning until restart. The observation start remains visible.
   This folds `1e5b8614…`, `249c0f77…`, and technically resolves `5980c27e…`.
3. **Bounded runtime monitoring.** Owner picked **A**: the always-running monitor evaluates the most
   recent **five eligible sessions**, floored by the activation date, and labels that exact range.
   The explicit local audit checks any older inclusive range. This folds `c697d8ed…` and `4ea6314f…`.
4. **Activation date.** Owner picked **A**: production coverage begins **2026-08-24 ET**, the first
   eligible date after the archive became production-capable. The two known SPY gaps remain honest
   failures while inside a selected/runtime window; no post-repair reset may erase them.

## Technical — settled (architect ↔ pm, one exchange)

1. **Live provenance is structural.** The evaluator receives only a read-only capability for the
   configured production session-book namespace. Fixtures and reconstructions use separate
   adapters/namespaces and cannot satisfy live coverage. A strict readable result additionally requires
   decoded identity and source timestamp to agree with index metadata. Mixed-origin production storage
   is out of scope; if ever allowed, it requires a persisted closed origin marker first.
   This folds `f28fa907…`.
2. **Valid range with zero sessions succeeds without a completeness claim.** Missing/reversed dates or
   a zero-sized runtime policy are invalid. A valid inclusive audit range that the shared calendar maps
   to zero expected sessions returns `NoExpectedSessions`, prints exactly
   `No books were expected in this window.`, emits no `PASS`, warns zero times, and exits 0.
   This folds `568491e1…`.

## Already aligned and locked

- Daily checkpoint: **10:30 a.m. America/New_York**; current session is `pending` before it.
- Storage runbook thresholds are independent per volume: warning at **70%**, critical at **85%**.
- Runtime evidence includes total and per-symbol process-local write-failure counts plus observation
  start; a restart resets the counters honestly.
- One deterministic evaluator is shared by runtime monitoring and the strict local audit.
- Runtime metrics read only the latest immutable in-memory snapshot; the operator request performs no
  archive I/O, vendor call, repair, recompute, cache mutation, or trader-route call.
- `NO_UI_CHANGE`; no trader page, scoring/tier/fingerprint change, paid monitoring, automatic cleanup,
  backfill, reconstruction, volume resize, retention change, or remote-body migration.
