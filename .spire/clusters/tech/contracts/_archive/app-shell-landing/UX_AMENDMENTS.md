# GATE Z amendment — app-shell-landing (RESOLVED by the conductor)

## Item: standalone `/positions` degraded-mark wording
- **Raised by:** Frontend executioner (GATE §5), flagged rather than silently diverging.
- **Conflict:** `UX_BLUEPRINT §6` introduces NEW degraded-mark strings for the standalone Positions page
  — `⏸ last known` / `tracking unavailable` / `no live quote`. But `FRONTEND_EXECUTION_CONTRACT §6`
  (relocate-don't-change) forbids editing the shipped `PositionRow` internals, which already render the
  equivalent **observable** degraded states with the EXISTING wording (`⏸ offline` for last-known,
  `unavailable` for tracking-unavailable). The new strings cannot be applied without editing a forbidden
  internal.

## Resolution (conductor, GATE Z): accept the EXISTING wording
- **`relocate-don't-change` wins over the cosmetic wording delta.** Editing `PositionRow` for a
  string change would (a) violate the feature's binding no-edit boundary and (b) risk regressing the
  shipped single-position tracker for no behavioral gain.
- The **binding requirement is the observable behavior** (ACs PosLive-2/3/4): on 404 / null-quote /
  refresh-fail the position **row persists, the affected cell shows a degraded last-known/unavailable
  state, nothing blanks or drops, no throw**. That is satisfied with the existing wording — verified by
  the executioner's `positions-page.spec.tsx`.
- **`UX_BLUEPRINT §6` is amended:** the standalone Positions page **reuses the existing `PositionRow`
  degraded wording** (`⏸ offline` / `unavailable`) rather than introducing new strings — which also keeps
  degraded-state copy consistent across the app.

## QA note (GATE Q)
Verify AC-PosLive-2/3/4 by **observable behavior** (row stays + cell degraded + never blank/drop), not by
the literal `UX_BLUEPRINT §6` strings. No code change required; no re-build. Owning role (UX) need not
re-author — this is a one-off carve-out, not a demotion of any promoted invariant.
