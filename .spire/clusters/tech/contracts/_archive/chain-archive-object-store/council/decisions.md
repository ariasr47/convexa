# chain-archive-object-store — R3 decisions

Source: `council/conflicts.json` (5 conflicts, quotes 5/5).

## Folded without Decision card

- **Ring bodies stay this ship.** PM R2 retracted the R1 preference to also move any OLTP-resident
  paid-book class. Architect names explicit 48-ring Non-move; residual ring BYTEA pressure inside
  14d+48 is accepted and **named** (AC-22), not silent. Ring-body migration is Out unless a later
  human card brings it In. Conflict `cec469e9…` folds here.

## Technical — settled (all converged)

- Ring deferral does **not** falsify session accumulation; residual 48/14d BYTEA is named AC-22.
- AC-15 and AC-24 Verify by **test**; AC-19–23 and AC-25 stay **review**.
- AC-8 binds exact `session archive not storing`; no “or store-error” alias.

## Product — operator ruled (Grok TUI question card)

1. **Exact shipped words.** Owner picked **A** (2026-08-20): reuse session-chain-archive §4 strings
   byte-for-byte. Missing object = `session book unreadable: <reason>` with opaque reason (no S3 /
   volume / BYTEA / path product vocabulary). No second deck. Conflict `c705f8f7…` folds here.
