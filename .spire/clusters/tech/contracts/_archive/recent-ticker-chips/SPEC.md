# SPEC — recent-ticker-chips

**Interface:** `.spire/clusters/tech/contracts/recent-ticker-chips/INTERFACE_CONTRACT.md`
(**NO_BACKEND_CHANGE** — this spec references it and must not contradict it).
**Brief:** `BRIEF.md` · **Route:** GATE V (FE-only) after owner wireframe **APPROVED 2026-08-11**
(`WIREFRAME.md` + `wireframe.html` — reference layout, not pixel-final).
**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET**).

## 1. Intent

Operators switching among liquid tickers should not retype symbols. A quiet **Quick** chip row
under the Command Deck control strip offers always-on liquid pins plus durable recents. Click →
same navigation as submitting the ticker field.

## 2. Acceptance criteria

| ID | Criterion | Verify |
|----|-----------|--------|
| AC-1 | On `/ticker/*`, inside the Command Deck card **below** the Ticker / Expirations / Persona strip, a **Quick** row of chips is visible | unit + widget/integration |
| AC-2 | Closed liquid pins always render: **SPY**, **QQQ**, **NVDA** (order fixed); not driven by recents emptiness | unit + widget |
| AC-3 | Clicking a chip navigates to `/ticker/{SYMBOL}` (uppercase); deck symbol input reflects the new symbol | integration / flow |
| AC-4 | The chip matching the **current route symbol** has a selected treatment (theme tokens only — not success/error green/red) | widget + review |
| AC-5 | Visiting symbols updates a **durable recents** list (client-local): after A→B→C reload still includes them; de-duped against pins; capped (≤8 recents beyond pins) | unit (store) + integration |
| AC-6 | When recents are empty/corrupt, **pins still show** — never a blank Quick row and never an error claiming “no symbols” (`[absent-is-not-none]`) | unit + widget |
| AC-7 | Sticky condensed bar is **unchanged** (no chips there); TopNav/widgets/API untouched | review + empty `apps/api` diff |
| AC-8 | Zero new hardcoded hex; chips use theme/paper/divider/text + selected via primary or amber **signal** slot only if already used for selection elsewhere — prefer outline/selected via `primary` / `divider` / `action.selected`; no P/L green/red | hex-discipline + review |

## 3. Non-goals

- Sticky condensed header redesign; chips on sticky bar.
- TopNav global recents.
- Server-synced recents / settings API.
- Expanding pin set via owner config UI (closed set in code for v1).
- Ticker input ergonomics (`/` focus, etc.) beyond what click already does.
- Alerts, scoring, vol-norm, backend.

## 4. Design

**Sole design authority:** SET `DESIGN_SYSTEM.md` (The Curvature Terminal).

**Placement (owner-approved wireframe):**
```
CommandDeck
  TickerHeader (unchanged)
  TickerToolbar (unchanged segments)
  Quick symbols row  ← NEW
```

**Copy:** micro-label `QUICK` (same caption pattern as toolbar segment labels).

**Chips:**
- Mono uppercase symbol text.
- Pill shape; hairline border via theme `divider`.
- Selected = current route symbol (quiet selected surface — not directional green/red).
- Optional visual separation between pins and recents (divider hairline or spacing) — not a second legend system.
- Narrow widths: wrap or horizontal scroll without breaking the deck.

**Do not** restate palette tables here. No second hex list. Wireframe is layout reference only.

## 5. Seams

| Surface | Change |
|---------|--------|
| `widgets/chrome/TickerToolbar.tsx` or sibling under `chrome/` | Render Quick row (or compose `QuickSymbols` under toolbar inside deck) |
| `widgets/chrome/CommandDeck.tsx` | Mount Quick row under toolbar if not inside toolbar |
| `features/…/recentTickers` (or `shared/lib` + chrome) | Pure store: list / recordVisit / pins constant; `resolveDurable` for key |
| Ticker page model / submit path | Call `recordVisit(symbol)` on successful navigation to a symbol |
| Tests | store unit + toolbar/deck widget + optional flow |

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/recent-ticker-chips/INTERFACE_CONTRACT.md`

**Summary:** **`NO_BACKEND_CHANGE`**. Empty `apps/api` diff. Navigation is client route only.
Recents are client-local durable state. Score/tier/fingerprint untouched
(`additive-keeps-score-byte-identical`).
