# ticker-load-experience — UX BLUEPRINT (GATE U·X)

> UX layer ONLY: component states, the skeleton component inventory, user-facing copy/labels,
> tooltip/glossary text, and the exact degraded-state wording. Stands alone against
> `PRODUCT_CONTRACT.md` (the 26 ACs), `ARCHITECTURE_CONTRACT.md` (the 4-state taxonomy §2, skeleton-
> over-single-bundle §3, pre-warm §4, concurrency/coalescing §5, last-trade-as-sibling §6, freshness
> §7, binding constraints §9), `BRIEF.md` (MEASURED LATENCY), `PROJECT_CONTEXT.md` (§2/§5/§6/§7).
> NO server internals, NO math, NO endpoint/payload decisions beyond NAMING the fields the UI consumes
> (those are pinned in `INTERFACE_CONTRACT.md`). The **AC → component-state map (§5)** IS the
> required-tests matrix; the FE implements that set and never chooses it.

---

## 1. What the trader sees, in one paragraph

The `/ticker/:symbol` page paints its full STRUCTURE the instant it mounts — toolbar, headline frame,
the stat-tile grid, the GEX chart frame, the term-structure card, the fresh-positioning section, the
off-exchange section, the setups section — each as a quiet placeholder, with NO single full-page
spinner gating the page. Each component then fills the moment ITS own source resolves (the live
readings from SSE, the analytics from the REST bundle, the AI read on its own clock). A NEW **Last
trade** readout sits directly beside the existing anchor price as an unmistakably SECONDARY line; it
is truly live (print-driven), honestly empty ("No recent print") between prints / overnight /
pre-first-print, and it dims/pauses WITH the other live fields on a feed drop — never freezing a stale
number into looking current. The anchor price, the levels, the flip, the score — everything the trader
already reads — are byte-identical and visually unchanged.

---

## 2. Component-state taxonomy (the visual spine — 6 states, never conflated)

Per ARCHITECTURE §2 there are four **data/flow** conditions; UX renders them as distinct LOOKS, plus
two per-component looks (`EMPTY` and the new live-empty). These are the canonical state names every
test in §5 references.

| State id | When (data-flow) | What the trader sees | Visually-distinct from |
|---|---|---|---|
| **DEFAULT** | source resolved with data | the real value / chart / list | — |
| **LOADING (cold skeleton)** | `data == null && error == null` (cold-load) | shimmer placeholders in the component's footprint; page structure fully present; NO full-page spinner | EMPTY (no shimmer), OFFLINE (not dimmed real values) |
| **EMPTY ("unavailable this cycle")** | a source RESOLVED to null/[] for that datum (not loading) | the component's existing muted "… unavailable this cycle" / "no … this session" text — NO shimmer | LOADING (shimmer), OFFLINE (no `⏸`) |
| **STALE (refresh-failed-after-success)** | `data != null && error != null` | the whole last-good bundle stays on screen behind the soft "Couldn't refresh…" warning | LOADING (nothing blanks), OFFLINE (a refresh notice, not a live notice) |
| **OFFLINE (live-feed-dropped)** | `data != null && streamOffline` (gap-watchdog >15s) | ONLY the live-derived tiles dim to 50% + caption `⏸ offline`; one `⚠ Live offline — reconnecting…` chip; static reads untouched | LOADING (real dimmed values, not shimmer), STALE (a live notice, not a refresh notice) |
| **ERROR (first-load-failed)** | `data == null && error != null` | the single red error Alert + **Retry** — the ONLY blank/error screen | every other state (this is the only blank) |

Plus the new last-trade-specific empty look (a sub-case of EMPTY, called out because it must read
as live-class, not static):

| **LIVE-EMPTY (last-trade only)** | live stream up, but no print value (`last_trade == null`) | the last-trade line reads **"No recent print"** in muted text — never a stale number | DEFAULT last-trade (a $value), OFFLINE last-trade (`⏸` + dimmed) |

**Binding boundaries (restated for UX):**
- `[live-vs-static-isolation]` — LOADING (cold) ≠ OFFLINE. A cold skeleton is "never loaded — shimmer";
  OFFLINE is "loaded, then the live transport dropped — real values dimmed." Different CSS classes,
  different conditions. The skeleton (cold) class must never appear post-load; the offline dim must
  never appear pre-load.
- The skeleton model replaces ONLY the page-level `!data` gate (TickerDashboard.tsx:497, and the
  `m &&` gate at :512). STALE / OFFLINE / ERROR are existing, shipped looks — preserved unchanged.
- Resolution is **per data-source, not per-tile-on-one-clock**: a tile leaves LOADING the moment ITS
  source (REST bundle | SSE payload | AI-rec) resolves — a slow bundle never holds back the live price,
  and a slow AI read never holds back the bundle tiles.

---

## 3. Skeleton component inventory (which placeholders exist, fed by which source)

The page paints structure immediately. Every row below is an individual placeholder region. "Source"
is which lifecycle clears its LOADING state. (Implementation is MUI `<Skeleton>` over the existing
component tree — no new data shape; see FRONTEND_EXECUTION_CONTRACT.)

| Region | Component (existing) | Source that fills it | LOADING look | Its EMPTY look |
|---|---|---|---|---|
| Headline price line | `<Typography variant="h1">` (:517) | REST bundle (anchor `m.price`) + SSE (live mid override) | text skeleton bar sized to the headline | n/a (bundle present ⇒ a price exists) |
| **Last trade (NEW)** sub-line | new sibling line beside headline | **SSE** `last_trade` | a short text skeleton beside the anchor while SSE not yet attached | **LIVE-EMPTY** "No recent print" |
| Live tiles: Gamma flip (live), Net flow, Spread | `Stat` (:529–544) | SSE payload | tile-shaped skeletons in the grid | per-tile `—` (existing) |
| Static tiles: Call/Put wall, Net GEX, Net DEX, Max pain, IV/HV, Vol/OI, IV skew, Term structure, VWAP, Off-exchange %, Opportunity | `Stat` (:525–576) | REST bundle | tile-shaped skeletons | per-tile "unavailable"/`—` (existing) |
| GEX chart frame | `GexProfileChart` (:603) | REST bundle (`strike_profile`) | chart-frame skeleton (axes box, fixed height) | n/a (chart present iff strikes present) |
| Term-structure card | term card (:616) | REST bundle (`term_structure`) | card-shaped skeleton | "Term structure unavailable this cycle." (existing) |
| Fresh positioning list | Vol/OI section (:651) | REST bundle (`strike_profile`) | a few line skeletons | "No strikes above the N× Vol/OI cutoff this session." / "Vol/OI unavailable this cycle." (existing) |
| Off-exchange blocks | blocks section (:686) | REST bundle (`off_exchange`) | a few line skeletons (only when Dark pool on) | "No blocks ≥ N shares…" / "Off-exchange data unavailable this cycle." (existing) |
| Setups | setups section (:737) | REST bundle (`signals`) | a couple card skeletons | "No clean setup right now." (existing) |
| AI recommendation | `AiRecPanel` (:595) | async AI-rec (its own lifecycle) | the panel's OWN existing loading look (unchanged by this feature) | the panel's OWN `unavailable` look (unchanged) |

Notes:
- The **toolbar** (ticker field, expiration selector, dark-pool switch, persona picker, chips) paints
  immediately at full fidelity — it is page chrome, not data, so it has no skeleton (it is interactive
  while the body loads). The small inline `<CircularProgress size={18}/>` next to the toolbar that
  indicates an in-flight refresh (:452) is PRESERVED — it is a per-refresh activity spinner, NOT the
  removed full-page gate, and does not blank anything.
- "Structure paints before any data" bar (AC-Skel-1): on mount with `data == null && error == null`,
  the headline frame, the stat-grid skeletons, the chart frame, and the section headers are all
  present; there is NO `<CircularProgress/>` occupying the body (the removed :497 gate).

---

## 4. User-facing copy (labels, microcopy, tooltips, degraded wording)

### 4.1 Last-trade readout — label, placement, copy (AC-LastTrade-1..5)

**Label:** `Last trade` (lowercase value; the word "trade" disambiguates it from the anchor "price").

**Placement (so it can never be mistaken for the anchor):** a SECONDARY line directly beneath /
beside the headline `m.ticker · $anchor`, rendered in `variant="body2"` `color="text.secondary"` —
visually subordinate to the `variant="h1"` anchor. It carries the live dot when live. It is NEVER the
large headline number. The anchor price line is unchanged.

**Exact copy by state:**

| Last-trade state | Wording | Treatment |
|---|---|---|
| DEFAULT (live print) | `● Last trade $XXX.XX` | secondary text, live dot `●` info-colored |
| LIVE-EMPTY (no recent print, live stream up) | `Last trade — no recent print` | muted `text.secondary` |
| OFFLINE (feed dropped) | `⏸ Last trade $XXX.XX` dimmed to 50% (the last-known print value, explicitly paused) — paired with the page's single `⚠ Live offline` chip | dimmed + `⏸`, identical treatment to the other live tiles |
| LOADING (SSE not yet attached, cold) | short text skeleton | shimmer |

Rationale carried in copy: the value differs slightly from the anchor by design. The tooltip (below)
states this so the trader reads it as "the last actual print" beside "the price the levels are built
on."

> NOTE ON THE PRE-EXISTING `· last $X` STRING: `liveStatus()` (TickerDashboard.tsx:201) currently
> appends `· last $X` to the connection chip using `live.mid` (the NBBO MID), which is mislabeled
> "last". This feature introduces a TRUE last-trade field. To avoid two conflicting "last" readouts,
> the connection-chip's `· last $X` segment must be **relabelled to reflect that it is the mid** (e.g.
> drop the word "last", or render `· mid $X`), so the only thing the trader reads as "last trade" is
> the new print-driven readout. This is a copy correction, not a behavior change — see
> FRONTEND_EXECUTION_CONTRACT §4. (No AC is violated either way; flagged so the two are never confused.)

**Last-trade tooltip (hover on the readout):**
> "The last actual trade printed for {ticker}, live off the trade tape — use it to reconcile against
> your broker's last trade (e.g. Webull). This is a readout only: the headline price and every level
> (walls, gamma flip, max pain) stay anchored to the NBBO mid, not to this print. Empty between trades,
> overnight, and before the session's first print — it never shows a stale number as current. Pauses
> with the live stream if it drops."

**Anchor-vs-last glossary line (for the field reference / any "what's this" surface):**
> "Anchor price = NBBO mid (smoothed, always-current; what the levels are measured against). Last
> trade = the last real print (can differ slightly; reconciles to your broker). They are different by
> design — the anchor never moves to the last trade."

### 4.2 The four loading/connection-state notices (preserved + the new skeleton)

| State | Notice copy | Where |
|---|---|---|
| LOADING (cold skeleton) | *(no banner — the skeleton structure IS the signal)* | in-body placeholders |
| STALE (refresh failed after success) | `Couldn't refresh — showing data from {age} ago. Retrying automatically.` (EXISTING, :494) | warning Alert above the body |
| OFFLINE (live feed dropped) | `⚠ Live offline — reconnecting…` (EXISTING, :465) + per-tile `⏸ offline` (EXISTING, :184) | single connection chip + dimmed live tiles |
| ERROR (first load failed) | `{error message}` with a **Retry** button (EXISTING, :487) | red error Alert (the only blank screen) |

OFFLINE chip tooltip (EXISTING, :65 — extend the enumeration to include last trade):
> "The live stream dropped. The positioning levels and the GEX chart below are still current as of the
> last data load — only live price, the last trade, spread, net flow and the live gamma flip are
> paused. Reconnecting automatically; no refresh needed."

### 4.3 Stale-warning honesty (AC-Stale-1/2)

The stale warning copy is UNCHANGED (:475): `data is {age} old — levels may be unreliable`. The fix is
that it stops firing *spuriously* mid-session under the real-time tier — that is governed by the
`STALE_AFTER_SECONDS` config value (Interface/Conventions, see INTERFACE_CONTRACT §4), NOT by copy. The
warning still fires honestly when data is genuinely old (outside covered hours / a real lag). No copy
change; the threshold change is what narrows the false positives. Tooltip on the warning is unchanged
(:473).

### 4.4 Speed — there is no copy for speed

AC-PreWarm-1/2 are observable as fill TIMING, not as text. A return/active-session visit fills
near-instantly; a first-ever cold visit shows skeleton structure for the few seconds it takes. UX adds
NO "fast"/"warming" badge — honesty is "it looks like loading until it's loaded." (The pre-warm is
invisible to the trader by design; see AC-PreWarm-3 / AC-Invariant-1.)

---

## 5. AC → component-state map (THIS IS THE REQUIRED-TESTS MATRIX)

Every PRODUCT_CONTRACT AC maps to the component state(s) that satisfy it and to ≥1 named test. The FE
implements exactly this set. The full named-test table (with edge/invariant cases enumerated) is
restated in FRONTEND_EXECUTION_CONTRACT §6 "Tests to write" so the FE never chooses the requirement
set. Test-kind legend: U=unit, C=component, F=flow-integration.

| AC | Component state(s) it exercises | Required test name(s) | Kind |
|---|---|---|---|
| AC-Skel-1 | LOADING (cold skeleton): structure paints, NO full-page spinner | `cold load paints page structure with no full-page spinner` | C |
| AC-Skel-2 | LOADING → DEFAULT per-source (live fills before bundle, AI on its own) | `each source fills its own region independently` | F |
| AC-Skel-3 | LOADING ≠ EMPTY | `cold skeleton is visually distinct from unavailable-this-cycle` | C |
| AC-Skel-4 | LOADING ≠ OFFLINE | `cold skeleton is visually distinct from live-feed-dropped` | C |
| AC-Skel-5 | source resolves null ⇒ EMPTY, not perpetual skeleton | `resolved-empty source shows empty state, not a stuck skeleton` | C |
| AC-State-1 | STALE | `failed refresh after success keeps last bundle behind soft notice` | C |
| AC-State-2 | OFFLINE | `live-feed drop dims only live tiles, statics keep last good values` | C |
| AC-State-3 | ERROR | `first-load failure shows single error + retry as the only blank screen` | C |
| AC-PreWarm-1 | DEFAULT fast-fill (active session) | `active-session visit fills near-instantly (warm path)` (FE: mocked-warm bundle resolves immediately, no skeleton lingers) | F |
| AC-PreWarm-2 | LOADING persists then DEFAULT (cold, slow) | `first-ever cold visit shows skeleton throughout, never a blank` | F |
| AC-PreWarm-3 | DEFAULT identical pre-warm vs not | `pre-warmed and non-pre-warmed loads present identical data/levels` | F |
| AC-Coalesce-1 | DEFAULT (consistency under concurrent loads) | covered BE-side; FE asserts `concurrent identical loads render one consistent page` | F |
| AC-Concurrency-1 | DEFAULT (complete page, just sooner) | `overlapping fetches present the complete page, no section dropped/reordered` | F |
| AC-Isolation-1 | DEFAULT via normal path (pre-warm unusable) | `pre-warm unavailable falls back to normal load, no error` | F |
| AC-Isolation-2 | one source fails ⇒ EMPTY for that component only | `single source failure shows only that component empty, rest loads` | C |
| AC-LastTrade-1 | DEFAULT last-trade | `last trade shows live print beside anchor and updates` | C |
| AC-LastTrade-2 | LIVE-EMPTY | `no recent print shows "no recent print", never a stale value` | C |
| AC-LastTrade-3 | OFFLINE last-trade | `last trade dims/pauses with live fields on drop, recovers on reconnect` | C |
| AC-LastTrade-4 | DEFAULT (secondary placement) | `last trade is secondary and never presented as the headline` | C |
| AC-LastTrade-5 | DEFAULT (anchor invariance) | `changing/clearing last trade never moves headline, levels, or flip` | C |
| AC-Stale-1 | STALE not firing spuriously (real-time) | `stale warning does not fire mid-session under real-time threshold` | C |
| AC-Stale-2 | STALE firing honestly | `stale warning still fires when data is genuinely old` | C |
| AC-Invariant-1 | DEFAULT byte-identical score path | `score/tier/gate/fingerprint byte-identical with feature on vs off` | F (FE asserts unchanged values across pre-warm/last-trade presence) |
| AC-Invariant-2 | EMPTY/LIVE-EMPTY/normal — never a new error | `no feature failure produces an error page beyond first-load-failed` | F |
| AC-Invariant-3 | LOADING vs OFFLINE vs STALE never conflated; last-trade is live-class | `live-vs-static isolation: last trade degrades live, statics persist` | C |

---

## 6. Compressor #3 handoff note

The interface delta, the BE/FE split, and the conformance reference are emitted in the three execution
files (`INTERFACE_CONTRACT.md`, `BACKEND_EXECUTION_CONTRACT.md`, `FRONTEND_EXECUTION_CONTRACT.md`) +
the standalone `.claude/tools/conformance/ticker-load-experience.json`. The single wire delta is the
SSE `last_trade` field; the REST bundle is byte-identical.
