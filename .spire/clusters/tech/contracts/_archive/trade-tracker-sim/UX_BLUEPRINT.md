# UX BLUEPRINT — Ghost-Trade Tracker · AI Reassessment · Opportunity Escalation

> Producer: UX/Tech-Writer (this session). Consumers: Backend & Frontend Executioners (via the
> Split Compressor → INTERFACE + BACKEND + FRONTEND contracts). No production code.
> Grounded against current `apps/dashboard/src/app/app.tsx`, `gex-profile-chart.tsx`,
> `libs/api/src/lib/gammaflow.ts`, `market_state_glossary.md`. Translates PRODUCT_CONTRACT.md +
> ARCHITECTURE_CONTRACT.md into UI states + copy only — no server internals, no math, no final
> payload schema (only the field NAMES the UI consumes; Interface finalizes shapes).

## Binding design principles (from both contracts)
- **Simulation is unmistakable.** A persistent `SIMULATED` marker appears everywhere the ghost
  trade shows; the entry flow states "paper trade, no broker, no real money." **No control may ever
  place a real order** this phase.
- **The mark is honest / labeled.** Live P/L is a **modeled mark** (Amendment A): exact at each
  chain snapshot (**anchor**), an **estimate** between snapshots (greeks off the live underlying),
  **theoretical** when no quote exists. Each state is labeled — a frozen value is never shown as a
  live traded price.
- **Two lanes, isolated.** The **trade record + entry facts + decision history are durable**
  (client-local) → **never blank** on a live drop or reload. The **P/L + current mark are
  live-derived** → degrade with the SSE stream (stale/offline, keep last, ⏸-flagged, self-heal),
  **freeze honestly overnight/closed**. Contract stats ride the **cached bundle** lane.
- **Over-trading guard.** Escalation emphasis, the Prime sim-entry prompt, and alerts fire on a
  **material change into a higher state** and are **de-duped (once per event)** — never every poll.
- **AI suggests, user decides.** Nothing auto-executes; every accept/reject is user-gated and
  recorded. Reassessment goes through the **external boundary** — the verdict may not be synchronous
  (Amendment B); the in-app accept/reject + decision-history machinery is unconditional.
- **Additive + best-effort.** Any failure in tracking/reassess/alerting shows an "unavailable" state
  for that area only; the **GEX chart and all existing stats render normally**. Cold-start (no bundle
  ever) stays the only blank screen.
- **P/L gain/loss DOES use green/red** — it is literal money, not a market-direction signal. (The
  "no directional color" rule binds the context metrics — off-exchange/DEX/Vol-OI/skew/term — not P/L.)

## Layout — where each datum surfaces
Reuse existing idioms: `Stat` tiles (grid), section components (`<Box mt:3>` + `h6` + ⓘ + caption +
content), the `offline` dim/⏸ pattern, the single connection chip, the cold-start/refresh/stale
signaling. New surfaces:

```
| toolbar … [regime] [● live / ⚠ Live offline] [stale alert]            |
| ── Prime setup banner (only at Prime + actionable + on entry) ──────  |  ← E.scalation CTA
|    ⚡ Prime setup — strongest edge now.   [Simulate this trade →]      |
| TSLA · $___   (levels @ $___ · N expirations)                        |
| ── GHOST TRADE panel (when a position is open; else entry button) ──  |  ← B/C/D/E/F
|    [SIMULATED] TSLA $250C · exp 2026-07-17 · Long ×1     [Close] [⋯]  |
|    P/L +$420 (+18%)   mark ≈$2.62 (modeled)   Δ.52 Γ.03 Θ−.08 V.11    |
|    DTE 25 · strike +1.2% vs spot · above flip, below call wall        |
|    [ Reassess ]   · alerts strip · decision history ▸ · Export        |
| ── stat grid (unchanged + Opportunity tile now tiered) ─────────────  |
| ── GEX strike profile / Term structure / Fresh positioning / blocks / Setups (unchanged) |
```
Placement rationale (in-lane): the **open position** sits directly under the headline (highest
"where do I stand" priority); the **Prime banner** sits above the headline so a top-tier edge grabs
attention; the **Opportunity tile** in the grid carries the always-on tier read.

---

## A. Opportunity escalation ladder
Upgrades the existing `Opportunity` `Stat` tile + adds the Prime banner. **Tiers: Dormant → Watch →
Actionable → Prime**, attention-scaling. De-duped: emphasis/banner change on a **material change
into a higher tier**, not while the score merely sits high.

**Consumes:** `signals.opportunity_tier` ('dormant'|'watch'|'actionable'|'prime') +
`signals.prime_prompt_eligible` (bool) (or derive tier from `opportunity_score` bands +
`ai_eval.ready/changed` — Interface decides; bands are operator config). `ai_eval.changed` /
`position_eval` drive the de-dupe.

| State | Trigger | Appearance / copy |
|---|---|---|
| **Dormant** | low tier | Tile quiet: neutral accent, value `{score} · Dormant`. No banner. |
| **Watch** | mid-low tier | Tile gains a subtle accent (e.g. info border) + value `{score} · Watch`. |
| **Actionable** | high tier | Tile prominent (warning/strong accent) + value `{score} · Actionable`. |
| **Prime** | top tier **AND** actionable | Tile strongest emphasis `{score} · Prime`; **Prime banner** appears (on entry into Prime) with the guided CTA. |
| **Prime — suppressed** | already in Prime, no new entry event | Tile stays Prime; **banner does NOT re-show** every poll (dismissed/seen) — over-trading guard. |
| **Below Prime** | tier < Prime | Banner absent; sim-entry prompt absent. |

- **Prime banner copy:** `⚡ Prime setup — the strongest edge GammaFlow sees right now.` + button
  `Simulate this trade →` (opens entry, pre-filled per the actionable setup) + a dismiss `×`. Tooltip:
  `Appears only at the top opportunity tier when the setup is actionable, and only when it first
  reaches Prime — not while the score sits high. A read, not advice; the trade is simulated.`
- **Opportunity tile ⓘ (updated):** append `Tier: Dormant → Watch → Actionable → Prime. Emphasis
  scales with the score; the sim-entry prompt unlocks only at Prime. Not a trade signal.`

## B. Ghost-trade entry (dialog)
Reached from the Prime banner CTA **or** an always-available `Open simulated trade` button (shown in
the trade-panel area when no position is open).

**Consumes (to populate the picker & fill basis):** the chain's expirations + strikes + per-contract
**option NBBO mid** + greeks/IV (the tracked-contract stats lookup, filter-independent).

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default** | opened | Form: **Expiration** (date), **Strike**, **Right** (Call/Put), **Quantity** (default 1, ≥1). Live readout: `Fill: mid $X.XX · Cost $X (mid × 100 × qty)`. Persistent `SIMULATED` chip + disclaimer. Confirm = `Open simulated trade`. |
| **Prefilled** | from Prime CTA | Picker pre-set to the actionable setup's contract/side; user can change before confirming. |
| **Quote unavailable** | no option mid for the pick | Fill line: `No live quote — fill will use a theoretical (Black-Scholes) mark.` Allowed, labeled. |
| **Blocked (one-per-ticker)** | a trade already open on this ticker | Entry hidden/disabled; copy `One simulated trade per ticker — close the open one first.` |
| **Error** | stats lookup failed | `Couldn't load the chain for entry — try again.` Rest of dashboard unaffected. |

- **Entry disclaimer (binding):** `Paper trade — no broker, no real money. Filled at the option mid;
  fees, slippage, taxes and assignment are not modeled.`

## C. Ghost-trade panel (persistent, durable)
The position at a glance. **Durable parts never blank**; **live parts degrade independently.**

**Consumes — durable (client-local, UI owns/persists):** contract identity (ticker, expiration,
strike, right), `side`('long'), `qty`, `entry_mark`, `entry_basis`, `entry_time`, `status`,
`realized_pl` (on close). **Cached lane:** tracked-contract `option_quote{bid,ask,mid}`,
`greeks{delta,gamma,theta,vega}`, `iv`, `dte`, and strike distances to `gex_spot`/`call_wall`/
`put_wall`/`gamma_flip` (from `market_state`). **Live lane:** `live.mid` (+ `live.live`,
`live.market_session`) → the modeled mark + P/L.

| State | Trigger | Appearance / behavior |
|---|---|---|
| **No position** | no open trade | Panel shows the `Open simulated trade` entry affordance only. |
| **Open · live (anchor)** | trade open, just re-anchored at a snapshot | `SIMULATED` chip; contract line; **P/L +$/+%** (green gain / red loss); current mark with basis chip **`snapshot mid`** + age; contract stats (price, Δ/Γ/Θ/V, IV, DTE, strike-vs-spot/walls/flip). |
| **Open · live (estimate)** | between snapshots | Same, mark shown as **`≈ $X.XX`** with basis chip **`modeled`**; P/L updates off the live underlying. |
| **Open · theoretical** | no vendor option quote | Mark basis chip **`theoretical`**; tooltip explains BS-from-IV. |
| **Open · stream offline** | SSE drop (`streamOffline`) | **P/L + current mark only** dim + **`⏸ offline`**, keep last value, basis chip → `last known`; **contract line, entry facts, contract stats, decision history stay solid.** Self-heals on reconnect — no manual refresh. |
| **Open · overnight/closed** | `live=false` overnight/closed | **P/L freezes** with a **`market closed — no overnight pricing`** indicator; last completed-session mark shown, not ticking. |
| **Open · stats stale** | bundle refresh failed/stale | Contract stats carry the existing `data {age} old` age; entry facts + P/L (live lane) unaffected by bundle age. |
| **Tracking unavailable** | best-effort tracking compute failed this cycle | Panel shows `Trade tracking unavailable this cycle — your position is safe.` + entry facts from the durable store; rest of dashboard normal. |
| **Closed** | user/AI Exit | Panel collapses to a **realized summary**: `Closed · realized +$X (+Y%) · held {duration}` + decision history + `Open a new simulated trade`. |

- **Manual controls (⋯ / buttons):** `Close` (manual Exit → books realized P/L), `Adjust qty`
  (manual trim/add within the cap), `Reassess` (§D). All write a decision record.

## D. Reassess + recommendation (accept / reject)
**Consumes:** the reassessment **boundary** — app emits a position-aware request; ingests a
`Recommendation { verdict ∈ Hold|Trim|Add|Exit|Roll, replacement_contract?(Roll), rationale,
verdict_id, status }`. Verdict may be async (Amendment B).

| State | Trigger | Appearance / copy |
|---|---|---|
| **Idle** | trade open, data fresh | `Reassess` button enabled. |
| **Disabled** | data stale / overnight / closed | `Reassess` disabled; tooltip `Reassess needs fresh market data — paused while the feed is stale/closed.` (no AI action on stale, per the alert rule). |
| **Pending** | request emitted | `Reassessment requested — awaiting the AI's read.` spinner; secondary `View request` (copyable structured hand-off, mirrors the strategy-prompt hand-off) for operator-mediated setups. |
| **Verdict ready** | recommendation ingested | **Recommendation card**: verdict chip (`Hold`/`Trim`/`Add`/`Exit`/`Roll`) + plain-language rationale; Roll shows the **replacement contract**; Add shows the **capped** qty. Buttons **`Accept`** / **`Reject`**. Header reminder `The AI suggests — you decide. Nothing is applied until you accept.` |
| **Accepted** | user accepts | Apply mapped change to the ghost position (Exit→close+book realized; Trim→reduce qty; Add→increase within cap; Roll→close + open replacement ghost; Hold→unchanged). Toast `Applied — recorded in decision history.` |
| **Rejected** | user rejects | Position unchanged; toast `Left as-is — recorded as your override.` |
| **Failed** | boundary error/timeout | `Couldn't reach the AI — try again.` (best-effort; position untouched). |

- **Verdict glossary (in tooltip):** `Hold = keep as-is · Trim = scale out (reduce qty) · Add =
  scale in (capped) · Exit = close and book P/L · Roll = close this and open the suggested
  replacement. Risk-first: the AI weighs downside before upside.`

## E. Reassessment alerts (in-dashboard, once per event)
**Consumes:** bundle-class — `position_eval.changed`/fingerprint, `opportunity_tier` change,
DTE threshold, wall/flip re-derivation; live-class — `live.mid` crossing a wall/`gamma_flip`, P/L
crossing target/stop (FE edge-detected, armed/fired). **No alert while `live=false`/overnight/closed
or data stale.**

| State | Trigger | Appearance / copy |
|---|---|---|
| **None** | no material event | No alert. |
| **Raised** | a defined event fires (edge) | An **alert row** at the top of the trade panel (most recent first) + a transient toast: `{event} — consider reassessing.` e.g. `Price crossed the call wall ($255) — consider reassessing.` / `Opportunity rose to Prime — consider reassessing.` / `P/L hit your +25% target — consider reassessing.` / `7 DTE left — consider reassessing.` Each carries a `Reassess` shortcut (never auto-queries). |
| **De-duped** | same condition persists across polls | **Does not re-raise** — fires once per distinct event (armed/fired edge; reuses the gate "changed" discipline). |
| **Suppressed** | data stale/overnight/closed | No alerts raised; existing stale/offline indicators already explain why. |
| **Alerts unavailable** | alert eval failed this cycle | Silent — alerts simply don't fire; never an error screen. |

## F. Decision history + export
**Consumes:** durable append-only `DecisionRecord[]` (versioned). Shown per current trade;
**export dumps the full versioned log.**

| State | Trigger | Appearance / copy |
|---|---|---|
| **Empty** | no records yet | `No decisions recorded yet.` |
| **List** | records exist | Collapsible list, newest first; each row: `{time} · {event} · {verdict→choice} · mark ${price} ({basis}) · P/L +$X (+Y%)`. e.g. `14:32 · Reassess · Trim → Rejected · mark $2.55 (modeled) · +12%`. |
| **Export** | user clicks `Export` | Downloads the full versioned, machine-readable log (for a future back-test). Toast `Decision history exported.` |

---

## Mark-basis labels (the honesty mechanism — exact)
One basis chip on the current mark, three values + a freshness age:
- **`snapshot mid`** — option NBBO mid from the latest chain snapshot (exact/anchor). Tooltip:
  `The option's quoted mid from the last chain snapshot (~every 2 min). Exact at the snapshot.`
- **`modeled`** (shown as `≈ $X.XX`) — estimated between snapshots from the live underlying move and
  the contract's greeks. Tooltip: `Between snapshots we estimate the option price from the live
  underlying and the contract's greeks — not a real traded price. It re-anchors to the quoted mid at
  each snapshot.`
- **`theoretical`** — Black-Scholes from cached IV when no quote exists. Tooltip: `No live option
  quote — this is a Black-Scholes estimate from the cached IV. Treat as approximate.`
- **`last known`** — during stream-offline: last computed mark, frozen + ⏸. Tooltip: `Live feed
  offline — last known mark, not current. Resumes automatically when the feed returns.`

## Degraded-state wording — live-stream loss vs bundle-fetch loss vs per-feature
- **Live-stream loss (SSE drop):** global chip `⚠ Live offline — reconnecting…` (existing). In the
  panel, **P/L + current mark only** go `⏸ offline` (basis → `last known`, last value kept, never
  framed as live); **contract line, entry facts, contract stats, decision history persist.**
  **Live-class alerts pause.** Self-heals on reconnect — no manual refresh.
- **Bundle-fetch loss (REST poll fail) after a prior success:** existing `Couldn't refresh — showing
  data from {age} ago.` The **contract stats** carry that age; **Reassess disabled** (stale data);
  **entry facts + P/L (live lane) unaffected.** Trade record never blanks.
- **Cold-start (no bundle ever):** the only blank/error screen (existing error + `Retry`). The
  **durable ghost trade still shows its entry facts + last-known P/L (clearly stale)**, since it does
  not depend on the bundle to exist; contract stats show `unavailable until data loads`.
- **Overnight / market closed:** P/L **freezes** with `market closed — no overnight pricing`; **no
  alerts fire.**
- **Per-feature best-effort failure:** tracking → `Trade tracking unavailable this cycle — your
  position is safe.`; reassessment → `Couldn't reach the AI — try again.`; alerting → silent. In all
  three the **GEX chart and all other stats render normally.**

## Microcopy & tooltips (exact strings, consolidated)
- **Simulated chip (persistent):** `SIMULATED` · tooltip `A paper trade — no broker, no real money,
  no real order is ever placed.`
- **Entry disclaimer:** `Paper trade — no broker, no real money. Filled at the option mid; fees,
  slippage, taxes and assignment are not modeled.`
- **Open button:** `Open simulated trade` · **One-per-ticker:** `One simulated trade per ticker —
  close the open one first.`
- **P/L tooltip:** `Running gain/loss = (current mark − entry mark) × 100 × qty. The 100× contract
  multiplier is included; fees and slippage are not. Green = gain, red = loss.`
- **Contract-stats tooltip:** `The held contract's current option price, greeks (Δ/Γ/Θ/V), IV, days
  to expiry, and where its strike sits vs spot, the walls and the gamma flip. From the chain
  snapshot — independent of the expiration filter above.`
- **Reassess button tooltip:** `Ask the downstream AI to judge this open position's health (hold /
  trim / add / exit / roll). The AI suggests — you accept or reject. Nothing is auto-applied.`
- **Reassess pending:** `Reassessment requested — awaiting the AI's read.` · **View request:**
  `View request` · **Failed:** `Couldn't reach the AI — try again.`
- **Accept/Reject reminder:** `The AI suggests — you decide. Nothing is applied until you accept.`
- **Add-cap note:** `Add is capped to keep the simulation from nudging over-trading.`
- **Alert template:** `{event} — consider reassessing.`
- **Export:** `Export decision history` → `Decision history exported.`
- Reused unchanged: `⚠ Live offline — reconnecting…`, `Couldn't refresh — showing data from {age}
  ago.`, cold-start error + `Retry`, `data is {age} old — levels may be unreliable`.

## Consumed-field naming (UI must read; Interface owns final shape/presence)
- **Durable (client-local, UI persists; versioned + exportable):**
  `GhostTrade { ticker, expiration, strike, right, side:'long', qty, entry_mark, entry_basis,
  entry_time, status, realized_pl_dollar, realized_pl_pct, schema_version }`.
  `DecisionRecord { event_type(open|close|accept|reject|alert|roll), clock_time, contract{...},
  mark_price, mark_basis(snapshot|modeled|theoretical|last_known), underlying_spot, pl_dollar,
  pl_pct, ai_verdict?, verdict_id?, user_choice?, tier, position_fingerprint, schema_version }`.
- **Cached lane (from bundle; filter-independent tracked-contract lookup):** for a given
  (expiration, strike, right): `option_quote{bid,ask,mid}`, `greeks{delta,gamma,theta,vega}`, `iv`,
  `dte`; plus existing `market_state.{gex_spot,call_wall,put_wall,gamma_flip}` for the distance read.
- **Live lane:** existing `live.mid`, `live.live`, `live.market_session` (drive the mark + P/L +
  offline/overnight). No new SSE field.
- **Escalation / alert dedupe:** `signals.opportunity_tier`, `signals.prime_prompt_eligible`,
  `position_eval{changed, fingerprint}` (present only when a trade is open), `ai_eval.changed`.
- **Reassessment boundary:** request assembled by the app; ingested
  `Recommendation{verdict, replacement_contract?, rationale, verdict_id, status(pending|ready|failed)}`.
- The UI must surface **no real-order path** and read **nothing** that would place one.

## Acceptance-criteria → state map
| PRODUCT_CONTRACT acceptance criterion | Satisfied by |
|---|---|
| Open a simulated long call/put at current price; panel shows entry price/time/qty, clearly simulated | B (entry) + C·Open + Simulated chip |
| % and $ P/L update as price moves; gain above entry, loss below; 100×qty | C·Open·live + P/L tooltip |
| Panel shows contract stats (price, greeks/IV, DTE, strike vs spot/walls/flip) | C·Open (contract-stats row) |
| Open trade survives page reload with same entry facts | C durable lane (client-local persist) |
| Live-stream drop → P/L+price stale/offline (kept, flagged), record+chart+stats stay; resumes no refresh | C·Open·stream offline + Degraded-state §live-stream loss |
| Market closed/overnight → P/L freezes with closed/stale indicator, no fake ticks | C·Open·overnight/closed |
| Trade keeps tracking when its contract is outside the DTE window | C cached-lane "filter-independent" tracked-contract lookup |
| Reassess returns a risk-first recommendation ∈ {Hold,Trim,Add,Exit,Roll} | D·Verdict ready |
| Accept applies the mapped change (Exit/Trim/Add-capped/Roll/Hold) | D·Accepted |
| Reject leaves position unchanged | D·Rejected |
| Every accept/reject writes a decision-history entry; nothing auto-applied | D·Accepted/Rejected + F + reminder copy |
| Decision/outcome history structured + exportable (not just on screen) | F·Export + DecisionRecord fields |
| Alert appears on a material event while open | E·Raised |
| Each alert once per event, no repeat while condition persists | E·De-duped |
| No alert while stale/overnight/closed | E·Suppressed + Degraded-state |
| Opportunity shows tiered emphasis increasing with score | A (Dormant→Prime emphasis) |
| Guided sim-entry prompt only at Prime + actionable, absent below | A·Prime / Below Prime + B prefilled |
| Escalation/prompt fires on change into higher tier, not every poll | A·Prime-suppressed (dedupe) |
| No way to place a real order; unmistakably simulated everywhere | Design principles + Simulated chip + B disclaimer |
| Tracking/reassess/alert failure → chart+stats normal, only affected area "unavailable" | C·Tracking unavailable / D·Failed / E·unavailable |

## Glossary additions (draft for market_state_glossary.md / downstream-AI contract)
```md
## Ghost-trade tracker (simulation — paper only)
- The ghost trade is a **simulated** long single-leg option (no broker, no real order). Fill basis =
  option **mid**; the **100× multiplier** is included; **fees/slippage/taxes/assignment are not
  modeled.** One open ghost trade per ticker.
- **Modeled mark:** live P/L uses the option's snapshot NBBO mid (exact at each ~2-min chain
  snapshot — the *anchor*), **estimated between snapshots** from the live underlying move + the
  contract's greeks (the *modeled* state), or **theoretical** (Black-Scholes from cached IV) when no
  quote exists. It is **not a real traded price** and is labeled accordingly; it **freezes honestly**
  overnight/closed and goes **offline (last known)** on a live-stream drop — never frozen-as-live.
- **Position eval** is a sibling of `ai_eval` present only while a trade is open: a coarse
  position-aware fingerprint + `changed`, used to fire reassessment **alerts once per event** (same
  de-dupe discipline as the entry gate). Alerts never fire on stale/overnight/closed data.
- **Reassessment** routes the open position + current `market_state` through the **external-AI
  boundary** (an extension of the existing hand-off) and returns a risk-first verdict ∈
  {Hold, Trim, Add, Exit, Roll}. GammaFlow does **not** call an LLM; the verdict may be operator-
  mediated. **Nothing is auto-applied** — the user accepts or rejects, and every decision is recorded
  in a versioned, exportable **decision history** (for later back-testing of AI-assisted edge).
- **Opportunity tiers:** `Dormant → Watch → Actionable → Prime`, derived from `opportunity_score` +
  `ai_eval`. Emphasis scales with the tier; the guided sim-entry prompt unlocks only at **Prime** and
  only on the change **into** Prime (de-duped). Display/context — not a trade instruction.
```
