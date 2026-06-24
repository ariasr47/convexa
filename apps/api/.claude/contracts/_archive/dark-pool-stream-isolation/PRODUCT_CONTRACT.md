# PRODUCT CONTRACT — Dark-pool block trades + live-stream isolation

> Producer: Product Manager (Session 2). Consumer: UX/Tech-Writer (Session 3).
> Input: GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md. No code, no math derivations.

## Feature & user value
A longer-dated swing trader watching a single ticker gets two things: (1) visibility into
**individual large off-exchange "block" prints** near current price — institutional-size activity
that the existing aggregate off-exchange ratio hides — as *context* beside the GEX structure; and
(2) a guarantee that when the **live stream drops** the dashboard never goes dark: the GEX chart and
all static positioning stats stay fully readable, and only the genuinely-live fields are flagged as
offline. Net value: more situational awareness without new noise, and a dashboard the user can trust
mid-session even on a flaky connection.

## User stories
- As a swing trader, I want to see the **largest recent off-exchange block prints** (size + price +
  how close to current price + how fresh) so I can tell whether real institutional size is changing
  hands near a level I care about.
- As a swing trader, I want blocks ranked by **notional (largest first)** and capped to a short list
  so I see what matters, not a firehose.
- As a swing trader, I want each block to show **how near it printed to current spot** so I can judge
  whether it overlaps a wall/flip without doing arithmetic.
- As a swing trader, I want blocks to be clearly labeled **context, not a buy/sell signal**, so I'm
  not nudged into reading direction into dark-pool prints.
- As a swing trader who already toggles off-exchange context off, I want blocks to **disappear with
  that same toggle**, so "off-exchange off" stays a single clean switch.
- As a swing trader on a flaky connection, I want the **GEX chart and static stats to keep showing
  the last good data** when the live stream drops, so a network blip never erases my analysis.
- As a swing trader, I want any **frozen live value to be visibly marked stale/offline** rather than
  silently presented as current, so I never act on a dead price.
- As a swing trader, I want the live fields to **recover on their own** when the connection comes
  back, without a manual refresh.

## Scope
**In:**
- Display of recent individual off-exchange **block prints** (size, price, proximity-to-spot,
  freshness/age), ranked largest-notional-first, capped to a top-N short list.
- A **user-facing definition** of what counts as a block (size threshold rule, below).
- Blocks governed by the **existing off-exchange toggle** (no new toggle).
- A defined **failure/degradation experience** for live-stream loss and bundle-fetch loss, including
  exactly which components persist cached data and which show an offline/stale indicator.
- Blocks treated as **best-effort**: if block/off-exchange data is missing or failed to compute, the
  rest of the dashboard is unaffected.

**Out:**
- Any directional / smart-money / accumulation-distribution interpretation of blocks.
- Multi-session block history or accumulation map (recent-window only).
- Block influence on the **opportunity score** (display-only in v1 — see Behavior rules).
- %-of-ADV (adaptive) block sizing — deferred to a future iteration.
- UI layout, component naming, endpoint/payload shapes, math, thresholds-as-code (UX/Interface/Eng own these).

## Behavior rules
### Dark-pool block trades
- **What is a block (user-facing rule):** a *single* off-exchange print whose size is at or above a
  notable **fixed share-count threshold** (configurable by the operator; ships with a sensible
  institutional-size default). The threshold is a fixed share count, **not** a percentage of average
  volume, in v1 — a fixed rule is predictable and easy to explain. An ADV-relative ("% of average
  daily volume") option is a documented future enhancement, not in this release.
- **Recency:** blocks are drawn from the **same bounded recent window** as the existing off-exchange
  data (a recent-lookback view, not all-day, not multi-session). Each block carries an **age** so the
  user can see how stale it is; the list reflects only that window.
- **Ranking & cap:** largest **notional** (size × price) first; capped to a **top-N short list** so
  the view stays scannable. Ties and overflow beyond the cap are simply not shown.
- **Per-block facts shown:** size, print price, **proximity to current spot** (how far above/below,
  as a signed nearness so wall/flip overlap is obvious), and freshness/age. No side, no direction.
- **Framing:** blocks are explicitly **context, not a signal**. The product must not label, color, or
  copy them as bullish/bearish, buy/sell, or "smart money." Off-exchange volume includes internalized
  retail and prints have no reliable side — this framing is binding.
- **Toggle:** blocks obey the **existing off-exchange/dark-pool toggle**. When off-exchange context is
  off, blocks are absent from the view entirely (consistent with off-exchange being omitted from the
  bundle and score when disabled).
- **Opportunity-score influence:** **none in v1.** Blocks are **display-only** and do **not** add to
  the opportunity score, even when a block prints at a gamma wall or the flip. (The existing
  *aggregate* off-exchange **levels** confluence bonus is unchanged — already capped and toggleable.)
  Rationale to honor downstream: dark-pool has no reliable side and the user is prone to over-trading;
  a per-print score nudge would manufacture false edge. Any future block→confluence bonus must stay
  **capped and toggleable**, and is out of scope here.

### Failure / degradation UX (live-stream error)
Two independent data lifelines feed the dashboard and must degrade independently:
- **Static bundle** (the GEX chart arrays + all positioning stats: walls, gamma flip, max pain, PCR,
  IV/HV, VWAP, HV, off-exchange ratio/levels/**blocks**). This is the authoritative, cached layer.
- **Live stream** (live spot/mid, spread, 5-minute net flow, live gamma flip, the session status
  chip). This is the only layer that can go "offline."

Required behavior when the **live stream drops / "Failed to fetch"**:
1. **Static persists, always.** The **GEX chart and every static stat MUST keep showing the last good
   cached values.** A live-stream failure may never blank, clear, or block the chart or static tiles.
   The screen is never wiped to an error page while a cached bundle exists.
2. **Only live fields degrade.** The live-derived fields (live price/mid, spread, net flow, live flip,
   session chip) are the *only* things that change state on a stream drop.
3. **No frozen value masquerades as live.** A live tile that can no longer update must be visibly
   marked **stale/offline** (a clear indicator + its last value, or a neutral placeholder) — never
   shown as if it were current. Honest live-vs-stale is binding (extends the existing `live=false` /
   `market_session` behavior).
4. **One clear connection state.** Surface a single, unambiguous **offline/reconnecting indicator** so
   the user knows the live layer is degraded and the static view is still trustworthy.
5. **Self-healing.** The system attempts to **reconnect automatically**; when the stream recovers, the
   live fields resume updating and the offline indicator clears, with **no manual refresh** required.
6. **Blocks ride with the static layer.** Because blocks travel in the cached bundle, a live-stream
   drop does **not** affect the block list — it stays visible like the rest of the static stats.

Required behavior when the **static bundle poll fails** (separate from the live stream):
7. **Last-cached-wins.** If a bundle refresh fails but a previous bundle was already loaded, keep
   showing the **last good bundle** and surface its **age/staleness** (reuse the existing freshness/
   `stale` signaling). Do **not** blank the chart or stats on a failed refresh.
8. **Cold-start is the only error screen.** Only when there has **never** been a successful bundle (a
   cold load that fails) may the dashboard show an explicit error/empty state with a retry affordance.
   Once any bundle has loaded, the product degrades to "stale," never to "blank."
9. **Best-effort dark-pool within a good bundle.** If the bundle loads but block/off-exchange data is
   unavailable for that cycle, the chart and all other stats render normally and only the off-exchange
   area shows an "unavailable this cycle" state. Missing blocks never imply a chart problem.

## Acceptance criteria (testable)
- [ ] With off-exchange context **on**, recent off-exchange prints at/above the block threshold appear
      as a list of blocks, **largest notional first**, capped to the top-N.
- [ ] Each block shows **size, price, proximity to current spot, and age**; none shows a side,
      direction, or buy/sell label.
- [ ] Toggling off-exchange context **off** removes the block list entirely; toggling it back **on**
      restores it.
- [ ] No block, individually or clustered at a wall/flip, changes the **opportunity score** in v1.
- [ ] When the **live stream is killed mid-session**, the **GEX chart and all static stats remain
      fully visible and unchanged** (last cached values).
- [ ] After a live-stream kill, **every live field is marked offline/stale** (not silently frozen),
      and a single offline/reconnecting indicator is shown.
- [ ] When the connection is restored, **live fields resume updating and the offline indicator clears
      without a manual page refresh.**
- [ ] When a **bundle refresh fails after at least one successful load**, the prior chart + stats stay
      on screen with a **stale/age** indicator; the screen is not blanked.
- [ ] On a **cold start where the first bundle never loads**, an explicit error/retry state is shown —
      and this is the *only* condition under which the static view is absent.
- [ ] When **block/off-exchange data fails for one cycle** but the bundle is otherwise good, the chart
      and all non-off-exchange stats render normally and only the off-exchange area shows
      "unavailable."
- [ ] The block list **never updates from the live stream** — it changes only when a new static bundle
      loads.
