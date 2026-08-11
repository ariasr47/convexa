# FRONTEND EXECUTION CONTRACT — DEX · Vol/OI · IV Skew · Term Structure

> For the Frontend Executioner. Binds to GAMMAFLOW_CONTEXT.md + INTERFACE_CONTRACT.md +
> the UX_BLUEPRINT component states. UI work ONLY — no server internals. Implement to spec.

## Files / components to modify
- `libs/api/src/lib/gammaflow.ts`:
  - `MarketState`: add `net_dex`, `call_dex`, `put_dex`, `chain_vol_oi_ratio`, `total_volume`
    (all `number | null`), `vol_oi_unusual_threshold: number`,
    `iv_skew: { slope; put_iv; call_iv; dte; expiration; reference: '25d' | 'moneyness' } | null`,
    `term_structure: { points: { dte; expiration; atm_iv }[]; state: 'contango' | 'backwardation' |
    'flat'; near_iv; far_iv; slope } | null`.
  - `StrikeRow`: add `net_dex` (+ optional `call_dex`/`put_dex`), `volume`, `vol_oi_ratio` (all
    `number | null`).
- `apps/dashboard/src/app/app.tsx`:
  - Add four **neutral-accent** `Stat` tiles: `Net DEX`, `Vol/OI`, `IV skew`, `Term structure`.
  - Add the **Fresh positioning (Vol/OI)** section (list of unusual strikes) and the
    **Term structure** mini-card. Place per the wireframe (DEX tile by Net GEX; the two sections
    between the GEX chart and Off-exchange blocks).
- `apps/dashboard/src/app/gex-profile-chart.tsx`:
  - Add a per-strike **Net DEX series** (neutral color, legend `Net DEX (delta)`); add `net_dex`,
    `vol_oi_ratio`, `volume` to the hover tooltip. Different units from GEX → label clearly; a
    secondary X-axis for DEX is acceptable. Keep GEX bars green/red; do NOT recolor by Vol/OI.

## Consumes (from INTERFACE_CONTRACT.md)
- `market_state.{net_dex,call_dex,put_dex,chain_vol_oi_ratio,total_volume,vol_oi_unusual_threshold,
  iv_skew,term_structure}`; `strike_profile[].{net_dex,call_dex,put_dex,volume,vol_oi_ratio}`.
- Each metric is **independently nullable** — a `null` means "unavailable this cycle" for that metric
  only. `vol_oi_ratio` is `null` for no/zero-OI or no-volume strikes (render blank, never 0, never
  flagged).
- These are **bundle (REST) fields** — they are NOT in the SSE payload. Do **not** read them from
  `live`, and do **not** subject them to the `streamOffline` watchdog.
- Read **nothing** from `signals.opportunity_score` / `ai_eval` for these metrics (display-only).

## Component states to implement (from UX_BLUEPRINT.md)
**All four (snapshot/static):**
- **Default**: render value/series (see below). **Neutral accent only** — never the green/red
  up/down accent (that reads bullish/bearish).
- **Unavailable** (`null`): tile value `unavailable` (muted); section variants show
  `Vol/OI unavailable this cycle.` / `IV skew unavailable this cycle.` /
  `Term structure unavailable this cycle.` The chart + other three + all stats render normally.
- **Stale**: ride the existing `data is {age} old…` alert; no separate per-metric badge.
- **Live drop / `streamOffline`**: **unchanged and NOT dimmed** — never pass `offline` to these
  tiles; they stay fully visible from the last bundle (they are static, like Net GEX / Max pain).

**Net DEX** — tile `Net DEX`, value signed `$X.XM`; chart gains the per-strike DEX series + tooltip.
**Vol/OI** — tile `Vol/OI`, value `{chain_vol_oi_ratio}×`; **Fresh positioning** list = strikes with
`vol_oi_ratio >= vol_oi_unusual_threshold`, ranked by `vol_oi_ratio` desc, capped to a top-N short
list, row `$${strike} · Vol/OI {ratio}× · {volume} contracts`. Empty (none unusual) →
`No strikes above the {threshold}× Vol/OI cutoff this session.`
**IV skew** — tile value `{+/−}{|slope|} pts · {state}`; derive `state` from `slope` per the fixed
copy rule below; reference IVs + tenor in the ⓘ.
**Term structure** — tile value `{state}`; mini-card line over the **nominal 7/14/30/60/90 DTE**
buckets, each mapped to the **nearest available** `points[]` entry, **absent buckets omitted (never
faked)**; points labeled (DTE/expiration + ATM IV) on hover. Only 1 tenor → show the point, tile `—`.

**IV skew state copy rule (fixed):** `slope > +band` → `fear` ("downside hedging bid");
`slope < −band` → `greed` ("upside bid / complacency"); `|slope| ≤ band` → `balanced`. (Pick a small
band, e.g. ~0.5 IV pts; framed as "what vol is paying for," not a price call.)

Exact copy strings (tooltips, captions, value formats): use UX_BLUEPRINT.md → "Microcopy &
tooltips" verbatim.

## Degradation behavior (isolation — binding)
- A **live-stream drop degrades ONLY the existing live-derived tiles + the connection chip.** The
  four new metrics, the GEX chart, and every static tile keep rendering from the last bundle and are
  **never** dimmed or marked offline. Do not wire them into `isLive`/`streamOffline`.
- A **bundle-refresh failure after a prior success** keeps the whole bundle (incl. the four) on
  screen behind the existing `Couldn't refresh — showing data from {age} ago.` warning — never blank.
- **Cold-start** failure (no bundle ever) is the only blank/error screen (existing error + `Retry`).
- **Per-metric `null`** → only that metric shows "unavailable this cycle"; never an error screen,
  never implying a chart/bundle problem.
- **No directional framing:** no green/red on the four; no buy/sell, bullish/bearish, "smart money,"
  or "dealers bullish→do X" copy or color anywhere.

## Verification
- [ ] Bundle renders `Net DEX`, `Vol/OI`, `IV skew`, `Term structure` tiles (neutral accent); the
      GEX chart shows the per-strike DEX series + DEX/Vol-OI/volume in its tooltip.
- [ ] Change the Expirations filter → `Net DEX` (tile + chart series) moves with it; `Vol/OI` and the
      Fresh-positioning list do **not** change (full-chain); term/skew unaffected by the window.
- [ ] Strikes with `vol_oi_ratio ≥ threshold` appear in Fresh positioning; no/zero-OI strikes show no
      Vol/OI (blank). None unusual → the empty line.
- [ ] Term-structure card samples ~7/14/30/60/90 DTE nearest-available; missing buckets omitted (not
      faked); `state` label shown.
- [ ] IV skew tile shows slope + state + (in ⓘ) the two reference IVs and the tenor.
- [ ] Set any one metric `null` (mock) → only that metric shows "unavailable"; chart + other three +
      all stats render normally.
- [ ] Kill the SSE mid-session → live tiles go `⏸ offline` and the `⚠ Live offline` chip shows, while
      the four new metrics + GEX chart stay fully visible and **un-dimmed**.
- [ ] No toggle/control was added for any of the four; they appear unconditionally.

## Out of scope
- No backend. No data-shape changes (bind to the interface contract). No new endpoints/params.
- No scoring/gate/setup wiring. No green/red directional accents on the four. No client re-computation
  of the metrics (consume server values; only the skew `state` word + display-bucket sampling are
  FE-derived).

## Definition of done
- [ ] UI implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed if the UI changed the system's described behavior/state
      (re-read touched files; same section structure).
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated (coordinate with backend so the folder is archived once both
      land).
- [ ] Committed.
