# liquid-names-session-capture — R3 decisions

Source: `council/conflicts.json` (8 conflicts, quotes 8/8).

## Self-revisions (folded, no exchange)

- **PM withdraws** cause-level distinguishability among no-identity cases
  (disabled ensure / never-captured / ensure failure / research miss).
  **Locked:** those all present as shipped `no session book…`. Four classes remain:
  session miss ≠ ring `no stored snapshot…` ≠ `session archive not storing` ≠
  `session book unreadable`. No fifth pending/ensure-failed copy.

## Technical — settled (one exchange, all `converged: true`)

- **AC-10 vs AC-13:** ensure-off / never-paid → `no session book`. Archive store unavailable stays
  `session archive not storing`. Classes disjoint.
- **Wake:** warm ticker/scanner may only non-blocking-signal the dedicated ensure worker.
  Massive / force-compute never request-scoped (including fire-and-forget tasks).
- **Miss copy:** no-identity causes share `no session book` (matches self-revision).
- **AC-18 and AC-25** Verify by **test**; AC-21–24 stay **review**.
- **Copy:** reuse shipped session-archive list/load fields and exact §4 strings; R4 does not mint
  new miss taxonomy.

## Product — operator ruled (Grok TUI question card)

1. **Same-day retry.** Owner picked **A** (2026-08-20): after a failed extra Massive/force-compute,
   the off-path worker **may retry later the same ET day** while identity is still absent.
   At most one in-flight fetch (singleflight). No extra Massive on the trader request path.
   A blip does not spend the day. New ET date = new identity.
   Conflicts `aae649d8…` and `e53e1d65…` fold here.

2. **Deadline (folded with A, not re-asked):** ship-blocking hit for `(SPY|QQQ|IWM, D)` is
   observable by **end of ET calendar day D** (retries stop when the date rolls). Not RTH-close-only.
