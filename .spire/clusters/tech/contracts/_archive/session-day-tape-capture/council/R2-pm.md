```json
{
  "role": "pm",
  "agree": [
    "Not an alias of `ENSURE_SYMBOLS` (ensure-set edits must not silently resize the tape).",
    "Path-A and Path-B append only while `MarketPhase::classify(now) == Rth` (09:30–16:00 ET, weekdays).",
    "Premarket / afterhours / weekend are **out of window**, not “no ticks”.",
    "**Chosen: all in-window trades + 1 s last quote.**",
    "First in-window warmer success persists immediately.",
    "If a tape name is not in `warm_symbols`, Path-B for that name is `not_attempted` that interval — **no new REST loop** to fill it.",
    "A gap is a first-class occupant, not a silent skip (SSE today `continue`s on lag — tape must not copy that collapse).",
    "Path-A and Path-B statuses are **independent**.",
    "No `MarketDataSourceKind::LiveMassive` on the occupancy document.",
    "Default three names are already a subset of `DEFAULT_LIQUID` / default `WARM_SYMBOLS`, so default hub membership does not grow.",
    "There is **no trader screen here.**",
    "SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table.",
    "A stored Tuesday tape does **not** fill a coverage hole.",
    "A tape **read** makes **zero** extra vendor fetches.",
    "A tape row is **never** a coverage `present` live paid book.",
    "Empty Path-A ticks can be a real quiet tape; treating that as `[FAIL]` fabricates a capture outage."
  ],
  "conflicts": [
    {
      "quote": "I am **not** sampling Path-A to dodge volume; if the already-received stocks stream cannot be appended for three names, that is an R2 architecture conflict, not a quiet “trades only” narrowing.",
      "source": "pm",
      "why": "Architect showed unsampled quotes on these names can run at hundreds to thousands per second — enough to put the live tick path at risk and to approach quote-file volume this BRIEF culled. Trades-only would drop the mid the desk anchors on. I cannot defend an unsampled-all-quotes lock, and I will not fall back to trades-only.",
      "proposal": "Path-A keep-set this slice is every in-window last-trade print plus the last quote per 1-second bucket (vendor clock when present, else an explicit receive-clock — quality not collapsed). Both kinds remain on the tape and in operator counts. Trades-only stays rejected. Denser quotes are Future.",
      "kind": "technical"
    },
    {
      "quote": "Extended-hours stock events that already arrive **are kept** (do not throw paid ticks) but are **not required** to call a day complete.",
      "source": "pm",
      "why": "The BRIEF job is an open-to-close day. Architect appends only during regular hours; premarket and afterhours are out of window, not empty. Keeping extended-hours ticks is a volume and occupancy expansion I added beyond open-to-close.",
      "proposal": "Capture window is regular hours 09:30–16:00 America/New_York on ET weekdays. Out-of-window ticks are not stored and are not empty-while-storing. Premarket/afterhours tape stays Future.",
      "kind": "technical"
    },
    {
      "quote": "That identity may be claimed **complete RTH** only if Path-A was storing across that window **and** every 5-minute mark either has a snapshot or is an honest **gap** (not silently filled).",
      "source": "pm",
      "why": "A through-window day with Path-B all gaps, or Path-A zero prints, would still pass this test and be labeled complete. That is a fabricated open-to-close success. UX correctly forbids a completeness headline and forbids treating a quiet Path-A day as a failed capture.",
      "proposal": "Drop operator-facing “complete RTH” as a success class. Keep partial (capture started after 09:30 or stopped before 16:00) distinct from a through-window day. Empty-while-storing, Path-B gaps, and kind/snapshot counts remain the honesty surface. No percent completeness.",
      "kind": "technical"
    },
    {
      "quote": "Persist interval **300 s** wall-clock per symbol, **independent of** `WARM_INTERVAL_SECS`.",
      "source": "architect",
      "why": "Elapsed 300 s from first in-window persist is not the same series as clock-aligned 09:30, 09:35, …, 16:00. Marks would drift with process start and warmer jitter, so “at most one per 5-minute mark” and “this mark is a gap” are not observable, and Tuesday 09:35 cannot be compared to Wednesday 09:35.",
      "proposal": "Keep Path-B on the already-paid warm/refresh persist hook, first in-window persist immediate, no extra vendor fetch. At most one snapshot per America/New_York 5-minute mark from 09:30 through 16:00 inclusive. Wall-clock 300 s is not a substitute for those marks.",
      "kind": "technical"
    },
    {
      "quote": "At least: `not_due` (weekend / future / before RTH), `not_storing` (store disabled), `missing` (due weekday, no identity), `empty_attempted` (window open, zero records), `gap` (lag/disconnect/drop recorded), `unreadable` (index without loadable body), `recording` (RTH open), `closed` (post-16:00 ET with whatever was written).",
      "source": "architect",
      "why": "`missing` and `not_due` on the tape vehicle are coverage words (`missing`, `not yet due`). Printing them as tape occupancy lets a tape miss read as a session-archive hole, which present-is-live-paid-only and UX’s hard ban forbid. A single `closed` after 16:00 also hides partial vs empty-while-storing vs gap, which must stay separate outcomes.",
      "proposal": "Keep Path-A and Path-B occupancy independent in the store. Operator literals follow UX’s closed tape set, plus a tape-specific ineligible/not-due word that is not coverage `not yet due`, plus a gap literal that is not `no path-a ticks`. Never print `missing` or `present` on tape. After 16:00 the operator can still tell partial from empty from gapped.",
      "kind": "technical"
    },
    {
      "quote": "when tape is enabled, production `construct` refuses if the tape body root is missing, unwritable, or conflicts with ring / session-archive index / session-archive body root (extend `body_root_conflicts`).",
      "source": "architect",
      "why": "If tape is enabled by default, refusing to start the process because a research tape root is missing or unwritable takes the trader desk down for insurance. Desk-wins isolation requires that case to be not-storing while bundle, scan, live stream, and session-ensure still serve. Colliding with session-archive or ring roots is a different fault: that would overwrite those stores.",
      "proposal": "Missing or unwritable dedicated tape root → desk still serves, operator outcome is not-storing, no false stored success. Tape root that would collide with session-archive or ring roots may refuse to start. Default-on tape only with a valid dedicated root; otherwise honest not-storing.",
      "kind": "product"
    }
  ],
  "asks": [
    "Architect: can the same already-paid warm/refresh persist hook key at-most-one Path-B snapshot per ET 5-minute mark (09:30–16:00 inclusive), with first in-window persist still immediate for the current mark, or is elapsed 300 s wall-clock a hard constraint?",
    "Architect: is 16:00 ET inclusive in-window for the close Path-B snapshot, or does phase classification already treat 16:00 as afterhours?",
    "Architect: does v1 config refuse any watchlist other than the locked trio SPY, QQQ, IWM, so a cap-8 expansion cannot silently become the product and cannot occupy extra hub slots?",
    "UX: what closed operator literals should the operator see for (a) a Path-A hub-lag / persist-drop gap, (b) a Path-B 5-minute mark with no snapshot while storing, (c) Path-B not attempted because the already-paid warm fetch is off — each distinct from `no path-a ticks`, `no path-b snapshots`, and `session day tape unreadable`?",
    "UX: what closed operator literal is an ET Saturday/Sunday (architect `not_due`) so it is not coverage `not yet due`, not weekday `no session day tape`, and not `no path-a ticks`?"
  ]
}
```
