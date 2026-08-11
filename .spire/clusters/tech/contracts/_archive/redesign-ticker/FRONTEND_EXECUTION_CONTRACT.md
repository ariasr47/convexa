# redesign-ticker — FRONTEND EXECUTION CONTRACT

> Role: Delivery UX / Tech-Writer, compressor #3 output. The FE lane's build sheet for the visual
> reskin + re-layout of the **Ticker / GEX viewer (`/ticker/:symbol`)**. Self-contained against
> `PROJECT_CONTEXT.md` (§7 FE-tests rule), the inbound `BRIEF.md`, the canonical `DESIGN_HANDOFF.md`
> §3, the `redesign-foundation` reskin convention (REUSED, not re-invented), the landed
> `apps/dashboard/src/app/theme.ts`, and the screenshots `02-ticker.png` / `10-ticker-offline.png` /
> `11-ticker-stale.png` / `12-ticker-trade-dialog.png`. Backend lane = **NO_BACKEND_CHANGE** (see
> INTERFACE_CONTRACT.md). This is the **only** execution file with real work.
>
> **GATE V fast-path** (UX → Frontend; PM/Architect/math skipped) — a visual reskin of an
> already-built, fully-working surface. There is **no product-behavior change** and **no new AC
> set**: the requirement set is the existing ticker suites' ACs (Skel-*, State-*, LastTrade-*,
> Stale-*, Isolation-*, Invariant-*) plus the new visual-fidelity ACs enumerated in §"Tests to
> write". The FE *implements* this set; it does not *choose* it.

---

## 0. The reskin convention (REUSED from `redesign-foundation` — binding, read first)

1. **Theme-level first, `sx`/styled extras second, NO logic change.** Reach for theme tokens by
   ROLE (`bgcolor: 'background.paper'`, `borderColor: 'divider'`, `color: 'text.secondary'`,
   `color: 'info.main'`, `color: 'warning.main'`, `color: 'success.main'`/`'error.main'`). Numerics
   use the established **mono handle** (`variant="mono"` or `theme.typography.monoFontFamily`) from
   feature 1 — do NOT scatter raw `fontFamily: 'Roboto Mono'`.
2. **Prototype-only extras are `sx` literals ONLY — never new theme keys** (ARCHITECTURE §1.4): the
   panel-raised `#1c2330`, the violet `#7b5cff` (only where the design already uses it — here it is
   NOT used; ticker uses no violet), the hatch fill. A kept-token hex duplicated inside `sx` is the
   smell to avoid (reference the role instead).
3. **NO change to logic, hooks, the SSE/poll effects, the watchdog, the cold-load gating, any
   `data-testid`, any tooltip string, any copy a test asserts, or any nullable-state copy.** The
   edit surface is: the JSX wrapper structure (to introduce the two tile GROUPS), MUI `sx` props,
   `styled()` accent on `StatTile`, and recharts color/label props — nothing else.
4. **Where pixel-exactness conflicts with a preservation rule or the honesty floor, preservation
   wins** (note the deviation inline). Fidelity never licenses removing a testid, changing asserted
   copy, or making the offline-dim / stale / cold-load states visually indistinguishable.

### 0.1 Tokens consumed by role (kept; the landed `theme.ts` — never re-base, never hard-code)

| Design role | Theme reference | Value (kept) | Where it surfaces on the ticker |
|---|---|---|---|
| page background | `background.default` | `#0e1117` | the `<Container>` page behind the cards |
| cards / panels / tiles | `background.paper` | `#161b22` | every `StatTile`, the GEX/term cards, the AI-rec card, the blocks/setup cards, the dialog |
| CTAs / links / **spot** line / regime-positive | `primary.main` | `#4f9cff` | "View AI hand-off", "Open simulated trade", the rec "Get"/"Accept" buttons, the **spot** dashed reference line |
| calls / +gamma | `success.main` | `#2ecc71` | Call wall accent, Net GEX-up, regime `positive gamma` chip, GEX bars right of zero |
| puts / −gamma | `error.main` | `#ff5c5c` | Put wall accent, Net GEX-down, regime `negative_gamma` chip, GEX bars left of zero |
| **LIVE** dot / line / connection chip | `info.main` (cyan ~`#29b6f6`) | MUI dark default | the live `●` dot in the last-trade readout + status chip, the **live** solid reference line on the GEX chart |
| gamma-flip line / **stale** / **offline** | `warning.main` (amber) | MUI dark default | the **flip** dashed line, the stale alert banner, the `⚠ Live offline` chip |
| borders / tile baseline / neutral accent | `divider` | subtle slate | tile outlines, neutral 3px left accent, chart zero line, the neutral **DEX** series |
| card radius | `shape.borderRadius` | `10` | all cards (controls 8px, chips pill) |
| numeric mono handle (feature-1 additive) | `theme.typography.monoFontFamily` / `variant="mono"` | Roboto Mono 600, tabular | the headline price, every tile value (19px target), the rec numerics, the dialog fill/cost |

### 0.2 Type scale (DESIGN_HANDOFF §Tokens — `sx` targets, no new theme keys)

Headline anchor ~27–35px (it is already `variant="h1"` — keep the role; tune `sx` to the design
size). Section heads (`variant="h6"`) 16–18px. **Tile value 19px** (mono). **Tile label 12px**
(`text.secondary`). Body 14px, caption 12–13px. Apply via `sx`/variant, never by re-valuing the
theme typography keys.

---

## Scope (build exactly this — nothing more)

Reskin these files in place; KEEP the SSE/poll lifecycle, the watchdog, the skeleton cold-load, and
the live-vs-static isolation entirely:

1. `apps/dashboard/src/app/ticker/TickerDashboard.tsx` — control bar, status row, headline +
   last-trade, **the two tile GROUPS (the main layout delta)**, the section heads, blocks, setups,
   the dialog mount.
2. `apps/dashboard/src/app/gex-profile-chart.tsx` — the recharts GEX strike profile.
3. `apps/dashboard/src/app/ai-rec/AiRecPanel.tsx` — the AI recommendation card + its state machine.
4. `apps/dashboard/src/app/ai-rec/StateExportDrawer.tsx` — the "View what's sent" tray.
5. `apps/dashboard/src/app/ghost-trade/TradeEntryDialog.tsx` — the shared Open-simulated-position
   dialog (ALSO opened from Positions in feature 3 — see §6 watch-item).

**OUT (do not touch):** the embedded **Positions portfolio + ghost-trade panel** internals
(`PortfolioPanel`, `GhostTradePanel`, `PositionsView`, etc. — DESIGN_HANDOFF line 153 "render as
today"; reskinned in feature 3 `redesign-positions`); the **auth modal** (`AuthDialog`,
`GoogleButton` — parallel `redesign-auth` session; the ticker only OPENS it via the CTA); `apps/api`
and every endpoint. Do NOT build the prototype's demo **"Connection (demo)" segmented control**
(`operator-vs-trader-path-separation`) — the real live/stale/offline states come from the stream.

---

## A. Control bar (`TickerDashboard` toolbar `<Stack>`)

**Target visual.** A labeled-field row on `background.default`, fields wrap with `rowGap`. The
existing fields are correct in WIRING — restyle only: Ticker `TextField`, Expirations
`Select multiple` (renderValue "All expirations" / "None selected" / "N of M"), the All/Clear
`ButtonGroup`, the Dark-pool `Switch`, the `PersonaPicker`, the **"View AI hand-off"** outlined
button. The inline 18px refresh `CircularProgress` stays. Buttons reskin to the convention (outlined
on `divider`, primary for any contained action). Numeric inputs may adopt the mono handle.

**States.** The control bar has no data state of its own; its disabled treatment (`disabled={!allDates.length}` on Expirations + the ButtonGroup) is preserved.

**Preserve (verbatim):** the **Dark pool** switch label + its tooltip string `Include off-exchange
(dark-pool) volume context. Off = excluded from the opportunity score and from what the downstream
AI sees.`; the **View AI hand-off** button text; the staged-DTE pre-fill `Chip` + its tooltip
`Visible, overridable pre-fill — it won't touch the current view or recompute anything.` and the
`Pre-filled {persona}'s preferred horizon (…DTE) for your next load` label; the Enter-to-navigate
behavior and the one-shot `pendingPrefill` ref; the All/Clear/`null`-vs-`[]` selection semantics.
**Do NOT add a Connection control.**

---

## B. Status row (regime chip + EXACTLY ONE connection chip + stale banner)

**Target visual.** Pill chips (radius 999). The regime chip: `success` for `positive_gamma`,
`error` for `negative_gamma`. The connection chip carries the live cyan / stale amber / offline
amber semantics below. The offline chip and the stale banner are amber (`warning`); the live chip is
cyan (`info`). The chip layout matches `02/10/11-ticker.png`.

**Enumerated states (the live/stale/offline matrix — the connection chip; exactly one shows):**

| State | Trigger (UNCHANGED logic) | Visual | Copy (PRESERVE verbatim) |
|---|---|---|---|
| **live** | `live.live && !streamOffline` | `info`/cyan outlined chip, a **pulsing** `●` dot (the `●` is in the label; add a CSS pulse on the chip's leading dot via `sx`, ≤180ms, gated to this state) | `● live · {session} · ${mid}` (e.g. `● live · open · $386.23`) + tooltip `Streaming live {feed} ticks.` |
| **session (not-live, not-offline)** | `live` present, `!live.live`, `!streamOffline` (overnight / closed / no-ticks) | `warning`/amber or `default` outlined chip per `liveStatus()` color | `○ overnight — no live data` / `○ market closed · mid $…` / `○ no live ticks · mid $…` + the existing per-session tooltip strings — ALL verbatim |
| **offline** | `streamOffline === true` | `warning`/amber chip; SUPERSEDES the session chip (exactly one) | `⚠ Live offline — reconnecting…` + the `OFFLINE_CHIP_TOOLTIP` verbatim |
| **stale** | `fresh.stale === true` (independent of the connection chip) | an amber `Alert severity="warning"` BANNER (`11-ticker-stale.png`) shown alongside the session chip; static levels still render | `data is {humanAge} old — levels may be unreliable` + its tooltip verbatim |

**Preserve:** the `liveStatus()` return (color/label/tip) byte-for-byte; the rule that the offline
chip supersedes the session chip; the `fresh.stale` banner text `levels may be unreliable` (a test
matches `/levels may be unreliable/`); every connection/stale tooltip string. The chip's
**color/label are read off the existing state** — the reskin only restyles, it does not re-derive.

---

## C. Headline + the display-only last-trade readout

**Target visual.** `TSLA · $386.23` as the `variant="h1"` anchor, price in the **mono handle**, with
the secondary `(levels @ $385.27 · {expirations})` clause beside it (`text.secondary`, body2). Below
it, the secondary last-trade line (`02-ticker.png`).

**Enumerated states (last-trade readout — `LastTradeReadout`, all preserved):**

| State | Trigger | Visual | Copy (PRESERVE verbatim) |
|---|---|---|---|
| **cold-load** | `live == null` | a short text `Skeleton` (`data-testid="last-trade-skeleton"`), shimmer — DISTINCT from live-empty | (no text) |
| **default (live print)** | `live != null`, `last_trade` is a number, not offline | `body2` `text.secondary`, leading **`●`** dot in `info.main` (cyan) | `● Last trade ${lt}` |
| **live-empty** | stream up, `last_trade == null` | `body2`, honest empty (never a stale value) | `Last trade — no recent print` |
| **offline** | `streamOffline`, last-known print | `body2`, **dimmed `opacity: 0.5`**, paused | `⏸ Last trade ${lt}` (or `Last trade — no recent print` if none) |

**Headline anchor invariant (`live-spot=NBBO-mid`, BINDING):** the `variant="h1"` price is
`isLive ? live.mid : m.price` and EVERY level (walls, gamma flip, max pain) stays on the NBBO mid /
static bundle. The last-trade readout is a DISPLAY-ONLY sibling — it must NEVER become the headline
and must NEVER feed the anchor/levels/flip. Keep the readout as `body2` (a test asserts the h1 does
not contain it and the h1 has no "Last trade" text).

**Preserve:** `data-testid="last-trade"`, `data-testid="last-trade-skeleton"`; the `LAST_TRADE_TOOLTIP`
string; the four exact phrasings above; the `variant="h1"` role for the anchor; the `(levels @ … ·
expirations)` clause text.

---

## D. The TWO tile GROUPS (the MAIN layout delta — today one grid)

**Target visual (DESIGN_HANDOFF §3 "Tiles — split into two labeled groups").** Split today's single
`auto-fill minmax(180px,1fr)` grid into **two LABELED groups**, each its own grid, with a small
section label above each (`text.secondary`, 12–13px). Each tile keeps: `background.paper`, a **3px
left accent**, a 12px `text.secondary` label + the existing `ⓘ` (`InfoOutlinedIcon`) signalling the
whole-tile tooltip, and a **19px mono value**. (`02-ticker.png` shows the two groups stacked.)

### Group 1 — **Live tape** (degrades on offline)

Tiles (move these into the first group; they already pass `offline={streamOffline}` where live):
**Net flow ({n}m)**, **Spread**, **Gamma flip (live)** (label drops "(live)" when not live), **VWAP**,
and the **Last trade** tile presence per the brief's group list. Left accent: directional
(success/error) where the value is signed, else `divider`.

### Group 2 — **Dealer positioning** (snapshot, never live, never dimmed)

Tiles: **Call wall** (up/success), **Put wall** (down/error), **Net GEX** (up/down), **Net DEX**
(neutral), **Max pain**, **IV / HV**, **Vol/OI**, **IV skew**, **Term structure**, **Off-exchange %**
(when present), **Opportunity** (left accent = the `tierMeta` color via `accentColor`).

**Enumerated states (apply per the existing logic — do NOT re-derive):**

| State | Which tiles | Visual | Copy (PRESERVE verbatim) |
|---|---|---|---|
| **cold-load (skeleton)** | the whole grid region while `data == null` | the shimmer `StatGridSkeleton` of `StatSkeleton`s — DISTINCT from offline + from empty | (no text) `data-testid="cold-skeleton"` inside `data-testid="cold-load"` |
| **live (default)** | Group-1 tiles when `isLive` | full opacity, mono value | live value, no `⏸` |
| **offline** | Group-1 live tiles ONLY when `streamOffline` | **`opacity: 0.5`** + the `⏸ offline` caption above the value; live values fall back to `—` / static flip | `⏸ offline` (verbatim) |
| **per-metric null (unavailable this cycle)** | any independently-nullable Group-2 tile | the muted `unavailable` value text, no shimmer, no error | `unavailable` (the tile value) + the per-tile `… unavailable this cycle.` tooltip where present |
| **dealer-positioning (always)** | Group-2 tiles | render the last bundle UN-dimmed even while Group-1 is offline | snapshot value |

**Invariant — `live-vs-static-isolation` (HARD, the headline invariant of this surface):** on a
stream drop ONLY the Group-1 live tiles dim to ~0.5 + `⏸ offline`; Group-2 / the GEX chart / every
static read keep rendering the last bundle un-dimmed; the cold skeleton is a DISTINCT state from
offline AND from "unavailable this cycle". The split must keep `offline={streamOffline}` ONLY on the
Group-1 tiles — never wire it to a Group-2 tile.

**Preserve:** every tile **label** string and every tile **`info` tooltip** string verbatim (e.g.
`Call wall` + its tooltip, `Put wall`, `Gamma flip (live)`/`Gamma flip`, `Net flow ({n}m)`,
`Spread`, `Net GEX`, `Net DEX` + `netDexTip`, `Max pain`, `IV / HV`, `Vol/OI` + `volOiTip`,
`IV skew` + `skewTip`, `Term structure` + `termTip`, `VWAP`, `Off-exchange %`, `Opportunity` +
`OPPORTUNITY_TIER_INFO`); the `—` fallback for non-live; the `unavailable` value for null metrics;
the `StatTile` `accent`/`accentColor` borders; `data-testid="cold-load"` + `data-testid="cold-skeleton"`;
the `⏸ offline` caption; the exact tile **values** (a test matches `$260`, `$248`, `73 ·`). The
grouping is a JSX wrapper change ONLY — do NOT alter which tile reads which field, the order within
each group's source rows, or the `isLive`/`offline` flags they receive.

---

## E. GEX strike profile (`gex-profile-chart.tsx`, recharts)

**Target visual (DESIGN_HANDOFF §3).** Horizontal net-GEX-by-strike, strikes high→low. **Green** =
call-dominated (net +) right of zero (`success.main`); **red** = put-dominated (net −) left
(`error.main`). Call/put walls drawn full-opacity + a **white hairline** outline; other bars ~0.82.
Three **reference lines, each labeled at the right edge**: **spot** (`primary.main`, dashed),
**gamma flip** (`warning.main`, dashed), **live** (`info.main`, solid, bold). Legend top-right
(`Call-dominated (net +)` / `Put-dominated (net −)` / optional `Net DEX (delta)`). Optional neutral
DEX series (`text.secondary`, no green/red). Card on `background.paper`.

**Enumerated states:**

| State | Trigger | Visual |
|---|---|---|
| **default** | bundle present, strikes in window | bars + spot + flip lines + legend |
| **live** | `isLive`, `live.mid > 0` | the **live** cyan reference line ADDED (passed as `liveSpot`) |
| **offline** | `streamOffline` (so `isLive` false) | the live reference line is **removed** (`liveSpot` null) — the bars/spot/flip persist un-dimmed |
| **empty** | no strikes in window | `return null` (no chart; the rest of the page renders) — preserved |

**Invariant:** the live reference line is the chart's ONLY live element — it appears only when
`liveSpot != null && liveSpot > 0` and is removed on drop; the GEX bars + spot + flip are static and
keep rendering the last bundle. This is the chart half of `live-vs-static-isolation` — preserve it.

**Preserve:** the chart info tooltip string (`Net dealer gamma at each strike. …`); the legend
labels; the `spot $X` / `flip $X` / `live $X` reference-line label format + the `nearest()` snap; the
wall hairline rule; the DEX-series presence gate (`hasDex`); the `ProfileTooltip` content. Recolor by
ROLE only — do NOT change which datum drives a bar/line.

---

## F. Term structure · Fresh positioning (Vol/OI) · Off-exchange blocks · Setups

**Target visual.** Section heads `variant="h6"` (16–18px) with the existing `ⓘ`. The term-structure
recharts line on a `background.paper` card; the Vol/OI + blocks + setups as outlined cards
(`02-ticker.png`). Setups: severity badge — HIGH amber / MEDIUM blue / LOW grey (map the existing
`s.conviction` chip color by ROLE; today it is a default chip — restyle to the severity scale without
changing the `conviction` value or text).

**Enumerated states (all preserved):**

| Region | empty / null state | Copy (PRESERVE verbatim) |
|---|---|---|
| Term structure | `term_structure == null` or <2 points | `Term structure unavailable this cycle.` |
| Fresh positioning | `chain_vol_oi_ratio == null` | `Vol/OI unavailable this cycle.` |
| Fresh positioning | no strikes ≥ cutoff | `No strikes above the {t}× Vol/OI cutoff this session.` |
| Off-exchange blocks | `off_exchange` absent | `Off-exchange data unavailable this cycle.` |
| Off-exchange blocks | no blocks | `No blocks ≥ {n} shares in the recent window.` |
| Off-exchange blocks | dark-pool toggle off | the whole section is hidden (preserved) |
| Setups | non-empty | a card per setup: `{name}` + `{conviction}` severity chip + `{rationale}` |
| Setups | empty | `No clean setup right now.` (`Alert severity="info"`) |

**Preserve:** all the copy above verbatim; the block `proximity` chip + `PROXIMITY_TOOLTIP`; the
blocks order (largest-notional-first, do NOT re-sort/re-cap); the `BLOCKS_TOOLTIP`; the
`freshCaption` + `volOiTip`; the `Fresh positioning (Vol/OI)` / `Off-exchange blocks` /
`Term structure` / `Setups` heading text (tests match these as headings, in document order — keep
the order: Term structure → Fresh positioning → Off-exchange blocks → Setups).

---

## G. AI recommendation card (`AiRecPanel.tsx`) + the persona / sign-in CTA

**Target visual (DESIGN_HANDOFF §3).** A `background.paper` outlined card titled `AI recommendation ·
{ticker}`, side-by-side with Term structure per the design (the FE may lay them out side-by-side via
a responsive grid wrapper in `TickerDashboard` — a layout wrapper change, not a panel-internal logic
change). Header carries the **persona-for-this-read** `Select` + the always-available **"View what's
sent"** button. Risk + invalidation FIRST (foremost block), `no_trade` as info (not red), provenance
chips (persona / as-of / SIMULATED), Accept (contained primary) absent on `no_trade`.

**Enumerated states (the rec state machine — ALL preserved; restyle only):**

| State (`phase`) | Trigger | Visual | Copy (PRESERVE) |
|---|---|---|---|
| **loading** | `ai.loading` | spinner + `COPY.loading.title` + the "asking the AI…" caption | verbatim |
| **signed-out (sign-in to ask AI)** | `!authGate.allowed \|\| authGate.promptText` | a DISABLED `Get` button + the `SignInPrompt` whose Sign-in action OPENS the auth modal via `authGate.signIn(AUTH_COPY.askAi.gate)` | `data-testid="ai-rec-auth-gate"`, `ai-rec-get-disabled`, `ai-rec-signin-prompt`; `AUTH_COPY.askAi.*` verbatim |
| **signed-in idle** | authed, no rec yet | the `ActionRegion` (Available / no-edge / cooldown / cap / no-key) + snapshot hint | all `COPY.*` verbatim |
| **byo-key CTA** | `unavailable_reason` ∈ no_key / over_limit / shared_key_unconfigured | the distinct CTA block routing to Settings | `ai-rec-state-no-key` / `ai-rec-state-admin-exhausted` / `ai-rec-state-shared-unconfigured` + `ai-rec-add-key-cta` |
| **unavailable** | other `unavailable` | calm `Alert severity="warning"` + Retry (cooldown/cap-aware) | `COPY.unavailable.*` verbatim |
| **produced** | a `produced` rec, `decision != no_trade` | risk-first block + plan/exit/sizing + Accept/Export/Dismiss | all field labels + `COPY.*` verbatim |
| **no_trade** | `produced`, `no_trade` | info-styled (`InfoOutlinedIcon color="info"`), **NO Accept** | `COPY.noTrade.*` verbatim |
| **stale / stale-born** | a newer bundle / born-stale | the stale chip + info strip + Fresh-rec action / the stale-born warning | `COPY.stale.*`, `staleStrip`, `staleBornStrip` verbatim |

**Invariants:** `server-side-gate-enforcement` — the signed-out CTA must keep the LLM un-invoked and
route the Sign-in through `authGate` (the server stays the boundary; do NOT weaken the gate or
locally bypass it). The rec card is **independently nullable** — a rec fault degrades ONLY this card,
never the chart/tiles/stream (keep the `data-testid="ai-rec-panel"` sibling-card isolation).

**Preserve:** `data-testid="ai-rec-panel"`, `ai-rec-auth-gate`, `ai-rec-get-disabled`,
`ai-rec-signin-prompt`, `ai-rec-state-no-key`, `ai-rec-state-admin-exhausted`,
`ai-rec-state-shared-unconfigured`, `ai-rec-add-key-cta`, `ai-rec-free-uses`, `ai-rec-own-key`; every
`COPY.*` / `BYO_KEY.*` / `AUTH_COPY.*` string; the `phase` derivation; the persona-for-this-read
caption (`Defaults to your active persona…`); the export-button presence in every state.

---

## H. "View what's sent" tray (`StateExportDrawer.tsx`)

**Target visual (DESIGN_HANDOFF §3).** A right-side `Drawer` (slide-out) on `background.paper`: the
egress-honesty `Alert` (the privacy line), a **Copy all** button, and three COPY-able sections
(Computed snapshot / Persona prompt / Field glossary) in `<pre>` blocks. Read-only — no LLM call,
costs nothing, works in every rec-panel state.

**Enumerated states (preserved):** **loading** (spinner + `Loading the export…`); **error**
(`Couldn't load the export right now — try reopening.`); **default** (the egress note + Copy all + 3
sections); the **copied** snackbar (`COPY.export.copied`).

**Preserve:** the `egress_note` / `COPY.export.*` / `EXPORT_HEADER` strings; the three section titles
+ the snapshot caption; the `aria-label="Close export"`; the read-only / no-LLM-call behavior; the
egress invariant (only context + persona prompt + glossary leave — no key, no other ticker, no
identity).

---

## I. Open-simulated-position dialog (`TradeEntryDialog.tsx`)

**Target visual (DESIGN_HANDOFF §3, `12-ticker-trade-dialog.png`).** A centered `Dialog` on
`background.paper`: title `Open simulated trade · {ticker}` + a **SIMULATED** chip; Expiration +
Strike selects; a CALL/PUT `ToggleButtonGroup`; Quantity; optional Stop/Target; the fill readout
(`Select a contract to see the fill.` → `Fill: mid $… · Cost $…`); the paper-trade disclaimer;
Cancel + the contained **Open simulated trade** confirm. Numerics may adopt the mono handle.

> Note: DESIGN_HANDOFF §3 references the title as `Open simulated position · {TICKER}` and lists
> Manual/Market/Limit tabs; the SHIPPED `TradeEntryDialog` title is `Open simulated trade · {ticker}`
> with a single fill mode and the disclaimer below. **Resolution: preserve the shipped title + the
> shipped structure** (preservation > fidelity — the title text + the SIMULATED/disclaimer copy are
> the honesty floor and the dialog is shared with feature 3). Do NOT add Market/Limit tabs or rename
> the title here. (The 3-mode entry the handoff describes lives on the Positions `PositionEntryDialog`
> path, reskinned in feature 3.) **[DEVIATION noted.]**

**Enumerated states (preserved):** **idle** (`Select a contract to see the fill.`); **loading** the
contract; **error** (`Couldn't load the chain for entry — try again.`); **fill (snapshot)** (`Fill:
mid $… · Cost $…`); **fill (theoretical)** (+ the Black-Scholes caption); **confirm disabled** until
a valid fill + qty ≥ 1; the **AI-prefill provenance** chip + `sizingNote` when seeded from a rec.

**Invariant — `no-real-order-path` (BINDING):** the dialog stays **SIMULATED**, with the mandatory
contained-confirm and the paper-only disclaimer. NO real-order affordance, ever. Keep the SIMULATED
chip, `SIMULATED_TIP`, and the `DISCLAIMER` string. Do NOT add a "send to broker" / "place order"
control under any fidelity argument.

**Preserve:** the title `Open simulated trade · {ticker}`; the **SIMULATED** chip + `SIMULATED_TIP`;
the `DISCLAIMER`; `Select a contract to see the fill.`; `Couldn't load the chain for entry — try
again.`; the fill/cost format; `Open simulated trade` / `Cancel` button text; the prefill seam
(every seeded field editable); the `onConfirm(NewTradeForm)` shape.

---

## J. Preservation rules (HARD — every one is a regression gate; the existing suites must stay green)

The reskin must keep `ticker-invariants.spec.tsx`, `ticker-load-experience.spec.tsx`, and
`ticker-load-experience.flow.spec.tsx` GREEN unchanged. Concretely:

- **Preserve verbatim every `data-testid`**: `cold-load`, `cold-skeleton`, `last-trade`,
  `last-trade-skeleton`, `ai-rec-panel`, `ai-rec-auth-gate`, `ai-rec-get-disabled`,
  `ai-rec-signin-prompt`, `ai-rec-state-no-key`, `ai-rec-state-admin-exhausted`,
  `ai-rec-state-shared-unconfigured`, `ai-rec-add-key-cta`, `ai-rec-free-uses`, `ai-rec-own-key`; and
  the shell testids the ticker tests assert (`app-shell`, `nav-ticker`).
- **Preserve test-asserted copy verbatim**: `Call wall`, `Put wall`, the tile values (`$260`, `$248`,
  `73 ·`), `⏸ offline`, `⚠ Live offline — reconnecting…`, `Retry`, `Couldn't refresh`, `Last trade
  $X` / `● Last trade $X` / `⏸ Last trade $X` / `no recent print`, `levels may be unreliable`,
  `Off-exchange data unavailable this cycle.`, `Vol/OI unavailable this cycle.`, `Term structure
  unavailable this cycle.`, the section headings (`Term structure`, `Fresh positioning (Vol/OI)`,
  `Off-exchange blocks`, `Setups`) and their document order, `No clean setup right now.`.
- **Preserve behavior + invariants (restated as binding constraints):**
  - `live-vs-static-isolation` (HARD): offline dims ONLY the Group-1 live tiles to ~0.5 + `⏸ offline`;
    the chart live-line is removed on drop; the stale banner shows on `fresh.stale`; the cold-load
    skeleton (`cold-skeleton`) is a DISTINCT look from offline AND from "unavailable this cycle"; the
    cold skeleton NEVER appears post-load and the offline dim NEVER appears pre-load; Group-2 / chart /
    static reads keep the last bundle un-dimmed.
  - `live-spot=NBBO-mid`: the `variant="h1"` anchor + every level stays on `live.mid`/`m.price`; the
    last-trade readout is display-only and never feeds it.
  - `best-effort-isolated-or-null`: each nullable metric keeps its own "unavailable this cycle" `—` —
    never a thrown error or a faked 0; one source failing (off_exchange) never blanks the rest.
  - `additive-keeps-score-byte-identical`: visual only; `apps/api` untouched; no control becomes a
    scoring input; the Opportunity readout reflects the bundle's `signals` unchanged.
  - `no-real-order-path`: the dialog stays SIMULATED + mandatory-confirm + paper-only disclaimer.
  - `server-side-gate-enforcement`: the signed-out "ask AI" CTA opens the auth modal via `authGate`;
    the LLM is not invoked; the gate is not weakened.
  - `operator-vs-trader-path-separation`: no demo "Connection" control; no `_ops` link.
  - Lifecycle: one EventSource per symbol (cleanup on unmount); the 60s poll; the 15s `STREAM_OFFLINE_MS`
    watchdog — all unchanged.
- **Fidelity never licenses** removing/renaming a testid, changing asserted copy, conflating the
  cold-load / offline / stale / empty looks, or making the SIMULATED dialog look like a real-order
  control. Where pixel-exactness conflicts with a preservation rule or the honesty floor, preservation
  wins (note the deviation — see §I).

---

## Tests to write (REQUIRED — the FE implements this set; it does NOT choose it)

> Per `PROJECT_CONTEXT.md` §7: unit + component + flow-integration, mocking ONLY the network boundary
> (`fetch` + `EventSource`), never a live backend. The **existing three ticker suites already encode
> every behavioral AC** (Skel-1..5, PreWarm-1..3, Coalesce-1, Concurrency-1, Isolation-1/2, State-1..3,
> LastTrade-1..5, Stale-1/2, Invariant-1/2/3) — they are the regression FLOOR: **keep them green, do
> not delete or weaken them.** This reskin adds only the NEW visual-fidelity ACs below (each = a
> component/region × its reskinned state, mapped to the named test). QA traces AC↔test at GATE Q — an
> uncovered AC is a FAIL even if the suite is green. This is a FLOOR; the FE may add unit tests
> (ceiling) but may never silently drop a required case (untestable → GATE Z bounce).

**Regression floor (run, keep green — do NOT modify):**
1. `ticker-invariants-suite-green` (AC-Inv-Reskin-1) — `ticker-invariants.spec.tsx` passes unchanged
   (live-degrade, cold-start isolation, best-effort isolation, scoring-untouched).
2. `ticker-load-experience-suite-green` (AC-Inv-Reskin-2) — `ticker-load-experience.spec.tsx` passes
   unchanged (cold-skeleton ≠ empty ≠ offline; the four post-load states; last-trade 1–5; stale 1/2).
3. `ticker-flow-suite-green` (AC-Inv-Reskin-3) — `ticker-load-experience.flow.spec.tsx` passes
   unchanged (cold→fill→last-trade→empty→drop→reconnect; warm vs cold; score byte-identical; no new
   error page).

**Layout delta — the two tile groups (new):**
4. `tile-groups-split-live-tape-vs-dealer` (AC-Layout-1) — render `/ticker/TSLA`; assert a **Live
   tape** group label and a **Dealer positioning** group label both render, with `Net flow`/`Spread`/
   `Gamma flip`/`VWAP` under the live group and `Call wall`/`Put wall`/`Net GEX`/`Max pain` under the
   dealer group (group membership, not exact pixels).
5. `dealer-tiles-undimmed-while-live-tiles-offline` (AC-Layout-2 / `live-vs-static-isolation`) — go
   live, drop the feed (advance 16s); assert the Group-1 live tiles show `⏸ offline` while a Group-2
   tile (`Call wall` / `$260`) renders un-dimmed (no `⏸` on it). (Extends State-2.)

**GEX chart reskin (new):**
6. `gex-chart-reference-lines-and-roles` (AC-Chart-1) — with a strike profile + `isLive`, assert the
   chart renders the spot / flip / live reference-line labels (`spot $…`, `flip $…`, `live $…`) and the
   legend (`Call-dominated`, `Put-dominated`); on drop the live line is removed while bars/spot/flip
   persist. (Reviewer also compares bar green/red + wall hairline to `02-ticker.png`.)

**Connection chip + stale banner reskin (new):**
7. `single-connection-chip-matrix` (AC-Status-1) — drive live → session → offline; assert exactly one
   connection chip at a time (live `● live · …`, offline `⚠ Live offline — reconnecting…` supersedes),
   and on `fresh.stale` the amber `levels may be unreliable` banner shows. (Extends State-2 / Stale-2.)

**Shared dialog + AI card honesty (new, restating preservation):**
8. `trade-dialog-simulated-no-order-path` (AC-Dialog-1 / `no-real-order-path`) — open the dialog;
   assert the SIMULATED chip, the disclaimer, `Open simulated trade` confirm, and NO real-order/"send
   to broker" control.
9. `ai-card-signin-cta-opens-modal-no-invoke` (AC-AI-1 / `server-side-gate-enforcement`) — signed-out;
   assert `ai-rec-signin-prompt` + the disabled `ai-rec-get-disabled`; clicking Sign-in routes through
   the auth gate (modal open intent) and NO rec request fetch fires.
10. `ai-card-independently-nullable` (AC-AI-2) — a rec fault renders `ai-rec-panel` unavailable while
    `Call wall` + the GEX chart + the score (`73 ·`) still render (no page blank). (Extends
    Isolation-2.)

**Reskin invariants (new):**
11. `reskin-no-backend-no-new-testid-loss` (AC-Reskin-Inv-1) — render the ticker; assert no new
    non-auth `/api/*` shape beyond the existing reads, and every preserved `data-testid` from §J is
    present.
12. `reskin-visual-fidelity-vs-screens` (AC-Reskin-Inv-2) — structural proxy: assert headline + the two
    tile groups + GEX chart + AI card + term structure + blocks + setups all present in one render
    (reviewer compares to `02/10/11/12-ticker.png`).

**Note for the FE:** ACs Skel-*, PreWarm-*, State-*, LastTrade-*, Stale-*, Isolation-*, Invariant-*
are satisfied by the **existing** suites (tests #1–#3) — do NOT rewrite them; the reskin must leave
them green. Tests #4–#12 are the NET-NEW required cases this reskin introduces. AC-Layout-1,
AC-Chart-1, and AC-Reskin-Inv-2 carry a reviewer-judgment component (side-by-side vs the screenshots);
the named tests are the structural proxies QA traces at GATE Q.
