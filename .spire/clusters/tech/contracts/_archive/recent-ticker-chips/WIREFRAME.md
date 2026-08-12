# WIREFRAME — recent-ticker-chips (for owner approval)

**Status:** **APPROVED 2026-08-11** (owner: good as a quick wireframe reference)  
**Feature:** `recent-ticker-chips` (BRIEF only; pre–design session)  
**Visual file:** open `wireframe.html` in a browser (self-contained)

---

## UI inventory — what changes?

| Surface | Change? | Notes |
|---------|---------|--------|
| **TopNav** | No | Unchanged |
| **CommandDeck hero** (`TickerHeader`) | No | Price, regime, connection chip, CTA stay as today |
| **CommandDeck sticky condensed bar** | No | Still `TICKER · $price` only — chips do **not** enter sticky (deferred sticky-header work is separate) |
| **TickerToolbar control strip** | **Yes — additive** | Existing TICKER / EXPIRATIONS / PERSONA segments unchanged |
| **New: Quick symbols row** | **Create** | One row of chips **under** the control strip, still inside the CommandDeck card |
| **Widget board** (Live tape, Dealer, …) | No | Unchanged |
| **API / score / SSE** | No | `NO_BACKEND_CHANGE` |

**Net new UI elements (only these):**

1. A quiet **caption** label: `QUICK` (or `SYMBOLS`) — same micro-label style as toolbar segments.
2. A horizontal **chip row**:
   - **Liquid pins** (closed set): `SPY` · `QQQ` · `NVDA` (always present).
   - **Recents** (durable local): last visited symbols, capped (e.g. 5–8), de-duped against pins.
3. **Current-symbol treatment** on the chip that matches the loaded route (selected outline / filled quiet — not green/red).
4. **Empty recents:** pins still show; no “no recents” empty-state that implies failure (`[absent-is-not-none]`).

**Interaction:** click chip → navigate to `/ticker/{SYMBOL}` (same as submitting the input). No hover-only meaning.

---

## Placement (recommended)

```
┌─ Command deck ─────────────────────────────────────────────┐
│  [hero: TSLA · $250.50 · live · Open simulated…]           │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  TICKER          EXPIRATIONS           PERSONA             │
│  [ TSLA____ ]    [ All expirations ▾ ] [ Default ▾ ]       │
│                                                            │
│  QUICK   ◄── NEW                                           │
│  [SPY] [QQQ] [NVDA] · [AAPL] [META] [IWM]   ◄── NEW chips  │
└────────────────────────────────────────────────────────────┘
   widgets below (unchanged)
```

**Rejected for v1 (call out if you want them instead):**
- Chips **inside** the sticky condensed bar (extra sticky scope).
- Chips in **global TopNav** (wrong page context).
- **Beside** the ticker field on the same row (crowds expirations/persona on mobile).

---

## States to approve

| State | What you should see |
|-------|---------------------|
| Default (has recents) | Pins + recents; current symbol chip marked selected |
| First visit / empty recents | Pins only — not a blank row, not an error |
| Current is a pin | That pin shows selected; not duplicated in recents |
| Narrow width | Row wraps or scrolls horizontally — no layout blowout |
| After click | Route changes; input reflects new symbol; chip selection moves |

---

## Explicit non-UI (not in this wireframe)

- Sticky condensed header redesign  
- Ticker input auto-focus / `/` shortcut polish  
- Alerts, vol-norm, scoring  

---

## Approval

**Owner ruling: APPROVED 2026-08-11** — use placement + pin set (SPY/QQQ/NVDA) + recents row under
CommandDeck toolbar. Wireframe is reference, not pixel-final. Folded into SPEC via GATE V (FE-only).

Original options (closed):


- **Approve** — use this placement + chip set for the design session  
- **Approve with changes** — list deltas (e.g. add IWM to pins, max N recents, label copy)  
- **Reject** — chips elsewhere or cancel the feature  
