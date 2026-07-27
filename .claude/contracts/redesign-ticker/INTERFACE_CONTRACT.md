# redesign-ticker — INTERFACE CONTRACT (FE ↔ BE truth)

> Role: Delivery UX / Tech-Writer, compressor #3 (Split Context). The single FE↔BE truth for
> `redesign-ticker`. Self-contained against `PROJECT_CONTEXT.md` + the inbound `BRIEF.md` /
> `DESIGN_HANDOFF.md` §3; no chat-history dependency. Mirrors the `redesign-foundation`
> INTERFACE_CONTRACT shape (feature 1 set the NO_BACKEND_CHANGE precedent for this program).

## Verdict: NO_BACKEND_CHANGE

This feature is a **purely visual reskin + re-layout** of the Ticker / GEX viewer
(`/ticker/:symbol`). It introduces **no new endpoint, no new request, no new field, no changed
payload, no changed param/header, and no `apps/api` edit.** It consumes ONLY existing surfaces,
unchanged. The SSE/poll lifecycle, the 15s payload-gap watchdog, the skeleton-first cold-load, and
the live-vs-static isolation machinery are all preserved byte-for-byte at the wiring level — only
presentation (theme tokens, `sx`, layout grouping) changes.

### What the in-scope surfaces consume (all EXISTING, UNCHANGED)

| Surface / region | Network behavior | Existing endpoint → fields the UI consumes (UNCHANGED) |
|---|---|---|
| **Ticker bundle** (headline anchor, stat tiles, GEX chart, term structure, Vol/OI, off-exchange blocks, setups) | REST poll on the 60s cache cadence (`POLL_MS`); re-fetch on ticker / expiration / dark-pool / position change | `GET /api/ticker/{symbol}` (params: `expirations`, `darkPool`, `position`, `minDte`, `maxDte`) → `TickerBundle`: `market_state.*` (`ticker`, `price`, `gex_spot`, `call_wall`, `put_wall`, `gamma_flip`, `max_pain`, `net_gex`, `net_dex`, `call_dex`, `put_dex`, `iv_hv_ratio`, `vwap`, `chain_vol_oi_ratio`, `iv_skew`, `term_structure`, `vol_oi_unusual_threshold`, `dte_min`, `dte_max`), `signals.*` (`regime`, `opportunity_score`, `opportunity_tier`, `prime_prompt_eligible`, `setups`), `strike_profile.strikes[]` (`strike`, `net_gex`, `net_dex`, `vol_oi_ratio`, `volume`), `expirations[]` (`date`, `dte`), `off_exchange` (`ratio_pct`, `levels`, `blocks`, `block_min_shares`), `meta.freshness` (`stale`, `data_age_seconds`, `snapshot_iso`). |
| **Live tape** (last-trade readout, Net flow, Spread, Gamma flip (live), VWAP-live, the chart live reference line, the connection chip) | SSE stream, payload ~every 1.5s; drop detected by the >15s `STREAM_OFFLINE_MS` gap watchdog | `streamTicker(symbol, { expirations })` (SSE) → `LiveUpdate`: `mid`, `last_trade`, `net_flow`, `flow_window_s`, `spread`, `gamma_flip`, `live`, `market_session`, `feed`. |
| **AI recommendation card** (persona-for-this-read, the rec/no_trade/unavailable/byo-key states) | REST status + on-demand rec request; gated by auth | `GET /api/recommendation/status/{symbol}` + the rec request endpoint + `GET /api/personas`, all via the existing `useAiRecommendation` / `useReadPersonas` hooks → `RecResponse` + status/cap/gate fields. **Read unchanged.** |
| **"View what's sent" tray** (`StateExportDrawer`) | REST read-only export; **no LLM call** | `fetchRecExport(symbol, { personaId })` → `RecExport` (`context`, `persona_prompt`, `glossary`, `egress_note`). **Read unchanged.** |
| **Open-simulated-position dialog** (`TradeEntryDialog`) | REST contract lookup for the fill | `fetchTrackedContract(symbol, { expiration, strike, right })` → `option_quote.mid` / `iv` / `dte`. **Read unchanged.** SIMULATED only; no order endpoint exists or is added. |
| **"Sign in to ask AI" CTA** | Opens the auth modal via the existing `useGate` boundary | The auth modal (`AuthDialog`) is OWNED by the parallel `redesign-auth` session — this feature only OPENS it. The server stays the gate of record (`server-side-gate-enforcement`); no client-side gate weakening. |

Every endpoint above is consumed exactly as the shipped `TickerDashboard` consumes it today. The
reskin reads the same fields, opens the same one EventSource-per-symbol, and runs the same watchdog.

### Scoring / invariants (restated — NO change)

- `apps/api` is **untouched**. The scoring path (`signals` / `opportunity_score` /
  `opportunity_tier` / the entry gate / `state_fingerprint`) is never imported, altered, or fed by
  anything in this feature. No control on the reskinned surface becomes a scoring input
  (`additive-keeps-score-byte-identical`).
- `live-spot=NBBO-mid`: the headline anchor + every level (walls, gamma flip, max pain) stay
  anchored to `live.mid` (when live) / `market_state.price` (static). The `last_trade` readout is
  DISPLAY-ONLY and never feeds the anchor — the request shape that produces those numbers is
  unchanged.
- `best-effort-isolated-or-null`: each nullable metric (`net_dex`, `iv_skew`, `term_structure`,
  `chain_vol_oi_ratio`, `off_exchange`) keeps its independent "unavailable this cycle" `—` — the FE
  contract preserves those exact copies; no new field is required to render them.
- No durable-key change — keys stay `convexa.*` (`loss-free-durable-migration`). No new
  localStorage key/value.
- No route/IA change; `/_ops/metrics` stays off-shell + unlinked
  (`operator-vs-trader-path-separation`). No demo "Connection" control is added to the trader path.

## Conformance spec

This feature adds **no new endpoint or field** to the FE↔BE seam. The existing interface
conformance surface (`.claude/tools/interface_conformance.py`) is therefore **unchanged** — there is
nothing new to verify at GATE Q beyond confirming the spec did not change. The block below is the
machine-checkable statement of that fact for system-1.

```json
{
  "feature": "redesign-ticker",
  "backend_change": false,
  "new_endpoints": [],
  "changed_endpoints": [],
  "new_fields": [],
  "changed_fields": [],
  "removed_fields": [],
  "consumed_existing_unchanged": [
    {
      "endpoint": "GET /api/ticker/{symbol}",
      "owner": "pre-existing TickerDashboard REST poll (not introduced by this feature)",
      "fields_read": [
        "market_state.ticker", "market_state.price", "market_state.gex_spot",
        "market_state.call_wall", "market_state.put_wall", "market_state.gamma_flip",
        "market_state.max_pain", "market_state.net_gex", "market_state.net_dex",
        "market_state.call_dex", "market_state.put_dex", "market_state.iv_hv_ratio",
        "market_state.vwap", "market_state.chain_vol_oi_ratio", "market_state.iv_skew",
        "market_state.term_structure", "market_state.vol_oi_unusual_threshold",
        "market_state.dte_min", "market_state.dte_max",
        "signals.regime", "signals.opportunity_score", "signals.opportunity_tier",
        "signals.prime_prompt_eligible", "signals.setups",
        "strike_profile.strikes", "expirations", "off_exchange", "meta.freshness"
      ],
      "request_changed": false,
      "response_changed": false
    },
    {
      "endpoint": "SSE streamTicker {symbol}",
      "owner": "pre-existing TickerDashboard SSE session + payload-gap watchdog",
      "fields_read": [
        "mid", "last_trade", "net_flow", "flow_window_s", "spread",
        "gamma_flip", "live", "market_session", "feed"
      ],
      "request_changed": false,
      "response_changed": false
    },
    {
      "endpoint": "GET /api/recommendation/status/{symbol} + rec request + GET /api/personas",
      "owner": "pre-existing useAiRecommendation / useReadPersonas hooks",
      "fields_read": ["RecResponse.*", "status.availability", "status.gate", "status.cap"],
      "request_changed": false,
      "response_changed": false
    },
    {
      "endpoint": "fetchRecExport {symbol}",
      "owner": "pre-existing StateExportDrawer read-only export (no LLM call)",
      "fields_read": ["context", "persona_prompt", "glossary", "egress_note"],
      "request_changed": false,
      "response_changed": false
    },
    {
      "endpoint": "fetchTrackedContract {symbol}",
      "owner": "pre-existing TradeEntryDialog fill lookup (SIMULATED; no order path)",
      "fields_read": ["option_quote.mid", "iv", "dte"],
      "request_changed": false,
      "response_changed": false
    }
  ],
  "scoring_path_byte_identical": true,
  "durable_keys_changed": false,
  "routes_changed": false,
  "conformance_surface_changed": false,
  "verify_at_gate_q": "nothing new — confirm interface_conformance.py output is unchanged"
}
```
