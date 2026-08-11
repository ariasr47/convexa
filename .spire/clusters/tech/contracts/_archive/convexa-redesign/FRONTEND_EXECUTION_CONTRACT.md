# convexa-redesign — FRONTEND_EXECUTION_CONTRACT (GATE V: TradeEntryDialog → Figma 118:1446, 2026-06-30)

> **Scope:** reskin the existing `TradeEntryDialog` (`apps/dashboard/src/app/ghost-trade/TradeEntryDialog.tsx`)
> to match Figma **`118:1446`** ("TradeDialog", file `4Njtm8QGWIgm4rA0UESg8n`). Owner: "conform with the
> Figma design and forget about any decisions made in the past regarding this feature." FE-only,
> **NO_BACKEND_CHANGE**. **Theme-native** (learned rule — bind colors to the MUI theme/tokens, NOT bespoke
> hex; the Figma's colors map to the theme, see the table). Bound to `PROJECT_CONTEXT.md` + `THEME_TOKENS.md`.
>
> "Forget past decisions" = conform the LAYOUT, WORDING, and FIELD SET to the Figma even where they differ
> from today (the dialog gains a fill-mode control; the title/button wording change). The ONE thing that
> stays regardless (it is a promoted canon invariant AND it's in the Figma anyway): the **paper-trade /
> `SIMULATED` nature** — no broker, no real order, mandatory paper framing. Everything else yields to the Figma.

## Target layout (Figma 118:1446, top→bottom) — a ~400px dialog
Use MUI (`Dialog`/`ToggleButtonGroup`/`Select`/`TextField`/`Button`) themed per the table below; match this
structure and order:
1. **Header row** (space-between): title **"Open simulated position · {ticker}"** (was "Open simulated
   trade") + a small **SIMULATED** badge; a **✕** close on the right. (Keep the AI-provenance chip when
   `prefill.provenance` is set — place it beside the badge.)
2. **Fill-mode segmented control** (NEW): three equal segments **Manual price · Market · Limit** in a
   rounded container. See "Fill modes" for wiring.
3. **EXPIRATION** — uppercase field label + a `Select` (value + ▾).
4. **STRIKE** — uppercase label + a `Select` (value like `$400` + ▾).
5. **CALL / PUT** segmented control — two equal segments; **active CALL = success green, active PUT = error
   red** (Figma shows CALL active green).
6. **QUANTITY** — uppercase label + number `TextField` (min 1).
7. **MANUAL PRICE** — uppercase label + number `TextField` (shown in Manual mode; see Fill modes). In Limit
   mode this row becomes **LIMIT PRICE**; in Market mode it's hidden.
8. **STOP (OPTIONAL) · TARGET (OPTIONAL)** — a 2-column row of number `TextField`s (existing behavior).
9. **Fill preview** line — the resolved fill / "Select a contract to see the fill." empty state (keep the
   existing fill-resolution + cost + theoretical-mark note).
10. **Disclaimer** (verbatim, keep): "Paper trade — no broker, no real money. Filled at the option mid;
    fees, slippage, taxes and assignment are not modeled." (In manual/limit mode the fill reflects the
    typed price — see Fill modes; keep the disclaimer text as-is.)
11. **Footer** (right-aligned): **Cancel** (text button) + **Open simulated position** (themed contained
    primary — resolves to the deep-blue+white button from the theme; sentence-case per app convention).

## Fill modes (NEW control — wire it, contained; do NOT touch the ghost-trade store or add a limit lifecycle)
Local dialog state only. The mode selects which price becomes the emitted `entryMark`:
- **Market** — use the auto-resolved snapshot/theoretical mid (today's behavior); the price input row is
  hidden; fill preview shows "Fill: mid $X · Cost …".
- **Manual price** — show the **MANUAL PRICE** input; `entryMark` = the typed price; cost preview uses it.
- **Limit** — show the **LIMIT PRICE** input; `entryMark` = the typed limit price.
Default mode = **Manual price** (the Figma's active tab). `canConfirm` requires a usable price for the
active mode (a resolved mid for Market; a positive typed value for Manual/Limit) + qty ≥ 1. Keep
`onConfirm(NewTradeForm)` emitting the same shape; set `entryMark`/`entryBasis` from the active mode
(if `MarkBasis` lacks a value for a typed price, add a narrow `'manual'` member in `ghost-trade/types.ts`
— that's the only allowed non-dialog edit; do NOT change `useGhostTrade`/the durable store). No async
limit/pending lifecycle — this is the single-position paper entry, not the positions portfolio.

## Color mapping — Figma hex → THEME token (no bespoke hex in the component)
| Figma | Use (theme) |
|---|---|
| dialog bg `#1c2330` | `extras.panelRaised` (as `AuthDialog` already does) |
| dialog border `#333b4a`, field borders | `divider` |
| dialog radius 14 / shadow | keep ~14px radius + a theme elevation shadow |
| input bg `#12171f` | `background.default` |
| active mode-segment `#29303d` | a themed selected surface (`action.selected`/`action.hover`) — via the ToggleButton `selected` state |
| CALL active `#38b875` | `success.main` |
| PUT active | `error.main` |
| SIMULATED badge bg `#1a3d29` / text `#38b875` | `alpha(theme.palette.success.main, 0.18)` bg + `success.main` (or `success.light`) text |
| title `#e6edf3` | `text.primary` |
| field values `#e6edf3` | `text.primary` |
| field labels `#6b7585`, muted text `#8b949e` | `text.disabled` (labels) / `text.secondary` (body) |
| footer primary button `#1976d2`+white | themed `<Button variant="contained">` (no color override — theme handles it) |
Field labels are UPPERCASE with letter-spacing (per Figma), rendered as small caption labels above each
field (not MUI floating `InputLabel`), matching the Figma's label-above-field pattern.

## PRESERVE (behavior/wiring — keep intact)
- `fetchTrackedContract` fill resolution `useEffect` (mid → theoretical BS mark), `fillState`
  idle/loading/error, the cost = `mark*100*qty` preview.
- The `EntryPrefill` seam (expiration/strike/right/qty/stop/target/provenance/sizingNote) + the open-reset
  `useEffect`; every seeded field stays editable; the `sizingNote` caption when present.
- `onConfirm(NewTradeForm)` shape + `onClose`; the `Dialog open/onClose`.
- SIMULATED badge + tooltip + the paper-trade disclaimer (verbatim).
- **Invariants:** `[no-real-order-path]` (paper only, no broker/order path — reaffirmed), `NO_BACKEND_CHANGE`,
  `[additive-keeps-score-byte-identical]` (dialog is not a scoring input), theme/token discipline.

## Verification (the lane runs this)
- `npx nx test dashboard`. The reskin renames the title ("Open simulated trade" → "Open simulated
  position") + confirm button, and adds the fill-mode control — so **update the ghost-trade / positions /
  ai-rec specs** that assert the old title/button text or the dialog's field structure, preserving the
  behavioral coverage (open → pick contract → confirm emits the right form; prefill seeds fields;
  canConfirm gating). Do not drop a behavioral assertion; re-point it at the new UI. Report the final count.
- Grep the component for `#` color hex → zero (colors via theme/tokens).
- **Render-verify via preview MCP** (`preview_start dashboard` → :4300, TSLA): open the dialog (the header
  "+ Open simulated trade" CTA, or the Prime banner). Confirm it matches the Figma — 400px dialog, SIMULATED
  badge, Manual/Market/Limit control, Expiration/Strike selects, green CALL / red PUT toggle, Quantity,
  the mode-driven price input, Stop/Target row, disclaimer, Cancel + deep-blue "Open simulated position".
  Report resolved computed styles for the dialog bg, a field, the CALL toggle (active), and the footer button.
  Ticker screenshots can hang → prefer `preview_eval` computed styles / scope to `.MuiDialog-paper`.

## Definition of done
- Dialog matches Figma `118:1446` (layout/wording/field set), theme-native (zero color hex), with the
  fill-mode control wired (Market/Manual/Limit → entryMark), CALL/PUT green/red, SIMULATED + disclaimer kept.
- All wiring preserved (fill resolution, prefill, onConfirm, close). `npx nx test dashboard` green (specs
  updated for the new title/fields); lint clean; `git diff --stat -- apps/api` empty.
- Hand back: files changed, test count, the specs updated + why, and the render/computed-style verification.
- **Do not commit** — the conductor render-verifies and commits.
