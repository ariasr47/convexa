# Convexa redesign — Figma ⇄ Code component map

> **Purpose (Pro-plan substitute for Code Connect).** Figma Code Connect needs an Org/Enterprise plan;
> this account is Professional, so we can't publish it. This file is the hand-rolled equivalent: for every
> Design-System component in the Figma file, it gives the **node id** (to inspect via the Figma MCP), the
> **code component + source file**, the **import**, and the **prop mapping** (Figma variant → code prop).
>
> **How an implementing agent uses this:**
> 1. Read the surface spec in `design_handoff_convexa_redesign/README.md` (behavior, copy, invariants) — the authority for STRUCTURE/copy. See [[convexa-redesign-spec-authority]].
> 2. For visual detail, inspect the Figma node: `get_design_context({ fileKey, nodeId })` and/or `get_screenshot`. Design context now returns the real **`--mui-palette-*`** tokens (theme.ts `cssVariables:true`).
> 3. Use the row below to know WHICH code component to render and HOW props map. Reuse the existing hook/store wiring (do NOT change data flow / SSE / gating / honesty invariants).
>
> **Figma file:** `Convexa — Web App (Design Reference)` — fileKey **`4Njtm8QGWIgm4rA0UESg8n`**.
> Node URL form: `https://www.figma.com/design/4Njtm8QGWIgm4rA0UESg8n/?node-id=<NODE>` (use `-` not `:` in URLs).
> **Tokens:** values are single-sourced in `apps/dashboard/src/app/tokens.ts` → MUI theme. Never hardcode a hex; use the MUI `sx` token (`primary.main`, `text.secondary`, …) or a `tokens.ts` value.

## Bespoke `ui/` primitives  (to be (re)created per the README; paths are the target)
| Figma component | node-id | Code component · source | Import | Figma prop → code prop |
|---|---|---|---|---|
| MonoValue | `31:9` | `MonoValue` · `apps/dashboard/src/app/ui/MonoValue.tsx` | `import { MonoValue } from './ui/MonoValue'` | Size {value,large,inline} → font-size via `sx` (19/27/14, mono 600, tabular-nums); `Value` text → children |
| Tile | `30:47` | `Tile` · `ui/Tile.tsx` | `import { Tile } from './ui/Tile'` | Accent {success,error,neutral} → `accent='success.main'\|'error.main'\|'divider'`; State {default,dimmed} → `dimmed` bool; + `label` `value` `tooltip?` `state?` |
| StatusChip | `28:18` | `StatusChip` · `ui/StatusChip.tsx` | `import { StatusChip } from './ui/StatusChip'` | Kind {live,stale,offline,positive,negative} → `kind`; `dot` bool (pulsing only for `live`); `label` node |
| ComingSoonBox | `32:3` | `ComingSoonBox` · `ui/ComingSoonBox.tsx` | `import { ComingSoonBox } from './ui/ComingSoonBox'` | hatch + dashed `divider` border (sx literals); `children` slot. Inert — never links (no-real-order-path) |
| ValueCard | `32:221` | `ValueCard` · `ui/ValueCard.tsx` | `import { ValueCard } from './ui/ValueCard'` | `icon` (@mui/icons-material), `title`, `body`, `to` (CTA route), `ctaLabel` |
| ConvexityMotif | `32:219` | `ConvexityMotif` · `ui/ConvexityMotif.tsx` | `import { ConvexityMotif } from './ui/ConvexityMotif'` | decorative SVG (2 beziers + radial primary glow); `sx?` for placement. No data |

## MUI atoms  (render `@mui/material` directly, themed by `tokens.ts`)
| Figma component | node-id | Code | Figma prop → code prop |
|---|---|---|---|
| Button | `27:21` | `@mui/material/Button` | Variant {Contained,Outlined,Text} → `variant='contained'\|'outlined'\|'text'`; State {Default,Hover,Disabled} → CSS state / `disabled`; `Label` → children. (Labels sentence-case: app sets `MuiButton.textTransform:'none'`.) |
| Chip | `33:11` | `@mui/material/Chip` | Variant {Filled,Outlined} → `variant`; State {Default,Selected} → `color`/filled vs outlined; `Label` → `label` |
| TextField | `33:203` | `@mui/material/TextField` | State {Default,Focus,Error,Disabled} → `error`/`disabled`/focus; `label`, `helperText`, value |
| Card | `31:187` | `@mui/material/Card` | Variant {Outlined,Elevated} → `variant='outlined'` vs elevation; children = `CardContent` |
| Tabs | `33:222` | `@mui/material/Tabs`+`Tab` (Underline) · `ToggleButtonGroup` (Segmented) | Type {Underline,Segmented}; active index. Nav tabs use the existing `NavLink` rules |
| Dialog (shell) | `35:3` | `@mui/material/Dialog` | Generic modal shell: title row + body + actions. (Specific modals below compose this.) |

## Feature molecules  (existing app components — re-skin, keep wiring)
| Figma component | node-id | Code component · source | Notes |
|---|---|---|---|
| Top-nav bar | `36:41` | `TopNav` · `shell/TopNav.tsx` (rendered by `shell/AppShell.tsx` layout) | Auth {SignedOut,SignedIn}: wordmark + nav (Ticker/Positions/Scanner, active=primary+2px underline+glow) + Log in/Sign up control or account menu (`AccountControl`). 60px sticky, paper@~82% + `backdrop-filter: blur(12px)`, 1240 content column |
| PositionRow | `34:72` | `PositionRow` · `positions/PositionRow.tsx` | State {profit,loss,dimmed}: mono numerics, P/L success/error, `PlSparkline` (broken-line, `connectNulls={false}`); live cells dim on offline. Columns: Ticker·Strategy·Qty·Entry·Mark·P/L·P/L%·Δ entry·Trend·Expiry·DTE |
| AuthModal | `40:61` | `AuthDialog` (+ shared `AuthForm`) · `auth/AuthDialog.tsx` | Mode {Sign in,Create account}: email + password, primary submit, `or` divider, white **Continue with Google** (`GoogleButton`), mode-switch link. Keep the security floor (password never echoed; non-enumerating 401). Full-page `/auth` shares the same form |
| TradeEntryDialog | `42:141` | `TradeEntryDialog` · `ghost-trade/TradeEntryDialog.tsx` (and `positions/PositionEntryDialog.tsx`) | Mode {Manual,Market,Limit}: SIMULATED badge, segmented tabs, Expiration/Strike selects, CALL/PUT toggle, Quantity, price area per mode, Stop/Target, disclaimer, Cancel + **Open simulated position**. No real-order affordance ever |
| StateExportDrawer | `41:3` | `StateExportDrawer` · `ai-rec/StateExportDrawer.tsx` | "What's sent to the AI" right tray: privacy line + **Copy all** + 3 COPY sections (Computed snapshot / Persona prompt / Field glossary) as mono code blocks. Read-only export, no LLM call |

## Foundations (read these as variables, not hardcoded)
- **Color** (Dark/Light modes) → MUI palette; code syntax = `--mui-palette-*` (e.g. `color/primary/main` → `var(--mui-palette-primary-main)` → `sx={{ color:'primary.main' }}`).
- **Spacing** 4/8/12/16/24/32/48 → MUI `theme.spacing` (8px base) / `sx` units. **Radius** control 8 · card 10 · pill 999. **Typography** Inter + Roboto Mono; ramp = the `Type/*` + `Mono/*` text styles.
- Non-palette extras (`color/bg/raised` `#1c2330`, `color/bg/hatch-alt` `#14181f`, text greys, `accent/violet`) are `sx` literals — see `tokens.ts` `extras`.
