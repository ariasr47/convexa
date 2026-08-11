# app-shell-landing — UX BLUEPRINT

> Role: UX / Tech-Writer (ROLE_LAUNCH_PROMPTS §3). Input = the locked PRODUCT_CONTRACT.md (the ACs,
> the owner-locked Convexa brand pins, Q1–Q6 resolutions) + ARCHITECTURE_CONTRACT.md (routing/layout/
> lifecycle shape + relocate-don't-change boundaries) + BRIEF.md + PROJECT_CONTEXT §5/§7. Self-contained;
> assume no chat history. This file owns the **visual + copy execution** and the **AC → component-state
> mapping** (which IS the required-tests matrix). It does NOT change product scope, invent behavior,
> touch server internals, do math, or make final endpoint/payload decisions. Next: compressor #3 (Split
> Context) emits INTERFACE_CONTRACT / BACKEND_EXECUTION_CONTRACT / FRONTEND_EXECUTION_CONTRACT (below).

This feature is **FE-only** (`NO_BACKEND_CHANGE`). It turns the single-page GEX dashboard into a
multi-page **Convexa** product: a full-bleed landing page at `/`, a persistent nav shell wrapping the
relocated Ticker viewer + Positions portfolio + a new Scanner placeholder, with `/_ops/metrics` left
untouched and off the shell. **Brand is UI-only** — no code/package/folder/store-key rename.

---

## 0. Design system inheritance (visual continuity — read, don't change)

Convexa reuses the **existing single dark MUI theme** verbatim (`apps/dashboard/src/app/theme.ts`,
mounted once in `main.tsx`). The new chrome (landing, nav shell, Scanner) is designed **into** this
palette so the relocated pages and the new surfaces feel like one app. No second theme provider, no
second router (AC-Inv-8, ARCHITECTURE §3.4).

| Token | Value (existing theme — do not change) | Convexa usage |
|---|---|---|
| `palette.mode` | `dark` | The whole app, landing included. |
| `background.default` | `#0e1117` (near-black) | Landing canvas, shell canvas. |
| `background.paper` | `#161b22` (raised slate) | Cards, nav bar, value-prop tiles, footer. |
| `primary.main` | `#4f9cff` (restrained blue) | The single accent: wordmark mark, primary CTA, active-nav indicator. Used sparingly. |
| `success.main` | `#2ecc71` | Existing positive/calls — relocated tiles only; NOT a landing decoration. |
| `error.main` | `#ff5c5c` | Existing negative/puts + cold-start error — relocated tiles only. |
| `divider` | theme default | Hairline borders (`variant="outlined"` cards), section rules. |
| `text.secondary` / `text.disabled` | theme default | Subheads, captions, the `⏸ offline` / "coming soon" muted states. |
| `typography.fontFamily` | `Inter, system-ui, …` | All copy. |
| `typography.h1` | `1.6rem / 700` | Existing dashboard headline; landing hero uses a **larger local override** (see §3) but the same family/weight character. |
| `shape.borderRadius` | `10` | All cards/buttons/chips. |

**Accent discipline (dark-fintech vibe, PD-Brand-2):** high-contrast near-black canvas, one restrained
blue accent, generous whitespace, clean type, hairline dividers. No gradients-as-decoration except the
hero motif (§3.1). Premium-by-restraint, not by ornament.

---

## 1. Surface inventory + route table (the chrome this feature owns)

| Route | Surface | In shell? | New / relocated | UX owns |
|---|---|---|---|---|
| `/` | **Convexa landing** | NO (full-bleed) | NEW | Full copy + layout + hero motif (§3) |
| `/ticker` → default `TSLA` | **Ticker viewer** (`TickerDashboard`) | YES | RELOCATED unchanged | Only the **live-degrade wording** (already shipped — restated §5) |
| `/ticker/:symbol` | Ticker viewer for `:symbol` | YES | RELOCATED unchanged | — (deep-link copy only) |
| `/positions` | **Positions portfolio** (`PortfolioPanel`) | YES | RELOCATED unchanged | Only the **standalone last-known-mark wording** (§6) + LOCKED Live tab restated |
| `/scanner` | **Scanner placeholder** | YES | NEW | Full copy + state (§7) |
| `/_ops/metrics` | Operator metrics | NO (own AppBar) | UNCHANGED | Nothing — must NOT be linked (AC-Inv-7) |

**Convexa wordmark spec (shared, landing + nav):** the word **Convexa** set in Inter 700, letter-spacing
tight (~`-0.01em`). A small **convexity-curve mark** precedes it — a short upward-curving (convex)
arc/stroke in `primary.main` (`#4f9cff`), ~18px in the nav, larger in the hero. It nods to the
gamma/convexity curve the product computes (PD-Brand-2 latitude) without being a literal chart. The mark
is decorative SVG only — no data, no fetch.

---

## 2. The persistent nav shell (`AppShell`)

Replaces today's bare `<AppBar>GammaFlow</AppBar>`. Chrome only — owns no feature data (ARCHITECTURE
§2.1). Mounts once for the in-shell group and persists across Ticker ↔ Positions ↔ Scanner (AC-Nav-4).

**Visual:** a top `AppBar` (`position="static"`, `elevation={0}`, `background.paper` `#161b22`, hairline
bottom divider). Left: the **Convexa wordmark + convexity mark** (links to `/` — the landing — a
deliberate, honest way back to the front door; this is NOT the operator route). Center/left-of-center: the
three nav entries. The shell renders the active page into an `<Outlet/>` below the bar.

**Nav entries (Q3 labels, final):** `Ticker` · `Positions` · `Scanner`. No `Scanner` lock glyph in the
nav itself (the placeholder page carries the "coming soon" honesty — AC-Land-6 / AC-Scan-1); optionally a
small muted "soon" caption chip beside Scanner is allowed but not required.

**Active-route indication (AC-Nav-3):** the active entry gets `primary.main` text + a 2px
`primary.main` bottom underline/indicator; inactive entries use `text.secondary`. Active match rules:
- `Ticker` active when path starts with `/ticker` (incl. `/ticker/:symbol`).
- `Positions` active on `/positions`.
- `Scanner` active on `/scanner`.

**NOT in the nav (binding, AC-Inv-7 / AC-Route-7):** no link, button, or menu item to `/_ops/metrics`.
The operator route stays reachable only by typing the URL, with its own AppBar, off the shell.

### Component states — `AppShell`
| State | When | Treatment |
|---|---|---|
| default | On any in-shell route | Wordmark + 3 entries + active indicator + outlet renders the page. |
| (no loading/empty/error/offline of its own) | — | The shell is static chrome; it has **no fetch**, so no loading/empty/error/offline state. A page-level error renders inside the outlet and never blanks the bar (AC-Inv-2 page isolation). |

---

## 3. The Convexa landing page (`/`, full-bleed, outside the shell)

A single dark full-bleed marketing surface. **Static — no fetch, no SSE, no compute** (ARCHITECTURE
§4.2). It does NOT render the trader nav shell (AC-Nav-5). Sections top-to-bottom:

### 3.1 Hero (AC-Land-1)
- **Convexity-curve motif (background):** a large, subtle convex (upward-bowing) curve rendered as a
  faint `primary.main` gradient stroke / glow sweeping behind the hero text — the gamma-curve nod for
  "Convexa." Low opacity (~8–14%), purely decorative SVG, no data. This is the one place ornament is
  allowed; it reads premium, not busy.
- **Wordmark:** the convexity mark + **Convexa** at hero scale (≈`2.75rem`, Inter 700).
- **Lead hook (PD-Brand-3, final wording):**
  > ## See the AI read on your real positioning.
  Supporting subhead (one line, in the spirit of the owner pin, refined for punch):
  > Connect your positions and get an AI read on your real risk — grounded in live dealer gamma, not vibes.
  (Plain-spoken; "dealer gamma" is the one term the glossary §8 defines inline.)
- **Primary CTA (AC-Land-3):** a prominent contained `primary.main` button:
  > **Open the Ticker viewer →**
  Navigates to `/ticker` (bare → default `TSLA`), landing **inside the nav shell**. This is the single
  unambiguous "enter the working app" action.

### 3.2 Value props — what works today (AC-Land-2, AC-Land-4)
A row/grid of **three** `background.paper` cards, each an honest, today-working surface with an optional
secondary CTA that navigates into its in-shell route (no dead-ends — AC-Land-4):

1. **Ticker / GEX analysis**
   - Copy: "Dealer gamma walls, the gamma flip, live order flow, and volatility context for any ticker —
     the structure that says where price is pulled and whether the regime fades or trends."
   - Secondary CTA: **Analyze a ticker →** → `/ticker` (in-shell).
2. **Simulated positions portfolio**
   - Copy: "Track simulated positions with live P/L, fills, grouping, and saved views. Paper-only — every
     trade is `SIMULATED`, nothing touches a broker."
   - Secondary CTA: **Open Positions →** → `/positions` (in-shell).
   - The word `SIMULATED` honors `[no-real-order-path]` honesty even on the landing.
3. **AI recommendations**
   - Copy: "An AI read on the current setup — risk-first, framed by your trader persona, grounded in the
     positioning the engine already computed. Advisory only; you confirm every paper trade."
   - Secondary CTA: **See it on a ticker →** → `/ticker` (in-shell). (No "AI on positions" claim — that's
     a future feature; PRODUCT_CONTRACT out-of-scope.)

If UX/FE ships only the primary CTA, AC-Land-4 maps onto the primary CTA per the contract's fallback; the
spec above ships secondary CTAs, so AC-Land-4 is tested against them directly.

### 3.3 Honesty section — coming soon (AC-Land-5, AC-Land-6, AC-Inv-3 alignment)
A visually-distinct band (muted `background.paper`, hairline border, a small `🔒`/"coming soon" chip)
that presents **un-built** capabilities truthfully — never a working button:

- **Connect a real brokerage** (the headline future capability):
  - Copy: "Connect your real brokerage positions — get the same AI reads on the risk you're actually
    carrying. **Coming soon.**"
  - Affordance: a **non-navigating** "Join the waitlist" / "Notify me — coming soon" control. It does NOT
    enter a broker flow and does NOT dead-end into a 404. Activating it shows a **coming-soon / waitlist
    acknowledgement** in place (inline confirmation text or a lightweight non-broker dialog/snackbar:
    "Thanks — we'll let you know when brokerage connect is live."). No real connection, no order path,
    no real-position read (`[no-real-order-path]`, Honesty floor). This is the seam the future
    `broker-connect` feature replaces.
- **Scanner — coming soon** (AC-Land-6, consistent with `/scanner`):
  - Copy: "A multi-ticker scanner to surface the best setups across names. **Coming soon.**"
  - Affordance: a link/button to `/scanner` (the honest placeholder page) OR a non-navigating coming-soon
    chip — either way it never presents Scanner as working.

**Binding:** no affordance in this section may present an un-built capability as functional. Any control
either (a) navigates to an honest "coming soon" placeholder, or (b) is a non-navigating waitlist/coming-
soon acknowledgement. Never a broker flow, never a dead-end.

### 3.4 Footer
- `background.paper`, hairline top divider. Convexa wordmark (small) + a one-line honest disclaimer:
  > Convexa is an analysis tool. All positions and trades shown are **simulated** (paper). Not investment
  > advice. No brokerage connection.
- No link to `/_ops/metrics`. Footer links (if any) stay within the product (`/ticker`, `/positions`,
  `/scanner`).

### Component states — `Landing`
| State | When | Treatment |
|---|---|---|
| default | Always (it's static) | Hero + value props + honesty section + footer render. |
| loading | n/a | **No fetch** → no loading state. (Observable: rendering `/` issues no network request.) |
| empty | n/a | No data-driven content → no empty state. |
| error | n/a | No fetch → no error state. A render fault stays isolated to the page; it never blanks the shell (the shell isn't even mounted here). |
| offline | n/a | No live feed → no offline state. The page is fully static and renders with no network. |

The landing's only "state" is **default**; its honesty section's coming-soon controls have a **resting**
state and an **acknowledged** state (after the waitlist click) — both non-navigating (§3.3).

---

## 4. Scanner placeholder page (`/scanner`, in shell)

Static "coming soon" (Q5 / AC-Scan-1). **Zero fetch, zero SSE, zero compute, zero backend call.**

**Visual:** centered within the shell outlet — a single `background.paper` outlined card on the dark
canvas. A muted `🔭`/`🔒` glyph, a heading, body copy, and a muted chip. No spinner, no skeleton, no
"loading" affordance (it must not imply it is working or fetching).

**Copy (final):**
- Heading: **Scanner — coming soon**
- Body: "A multi-ticker scanner that surfaces the strongest setups across names is on the roadmap. It's
  not live yet — for now, analyze one ticker at a time on the **Ticker** page."
- Chip (muted, `text.secondary`): `coming soon`
- Optional secondary link: **Go to the Ticker viewer →** → `/ticker` (in-shell; the only navigation
  affordance, and it's honest).

### Component states — `Scanner`
| State | When | Treatment |
|---|---|---|
| default | On `/scanner` | The static coming-soon card. |
| loading | n/a | **None** — no fetch. The absence of any loading/skeleton/spinner is itself the AC-Scan-1 requirement (no scan/fetch/compute is issued). |
| empty | n/a | None (no data). |
| error | n/a | None (no fetch to fail). |
| offline | n/a | None (no live feed). Renders identically with the network down. |

---

## 5. Relocated **Ticker viewer** — degraded-state wording only (relocate-don't-change)

The Ticker viewer (`TickerDashboard`) is **relocated unchanged** (ARCHITECTURE §4.1). UX does NOT redesign
its internals; it only **restates the already-shipped degraded wording** so the FE preserves it byte-for-
byte through the move, and so QA can trace AC-Inv-1 / AC-Inv-2. These strings exist today in `app.tsx`
and MUST survive the relocation verbatim:

| Degraded state | Trigger | Exact wording / treatment (UNCHANGED — preserve) |
|---|---|---|
| Live tiles dim + offline (`[live-vs-static-isolation]`) | SSE payload gap > 15s after having been live | Live-derived tiles (live gamma flip, net flow, spread) get `opacity: 0.5` + a `⏸ offline` caption; the static bundle (GEX chart, static tiles, blocks, term structure, fresh positioning) keeps rendering the last bundle. **AC-Inv-1.** |
| Connection chip | SSE drop | One chip supersedes the session chip: `⚠ Live offline — reconnecting…` (warning). Tooltip: the existing `OFFLINE_CHIP_TOOLTIP` ("The live stream dropped. The positioning levels and the GEX chart below are still current …"). |
| Cold-start failure (the ONLY blank screen) | No bundle ever loaded + fetch error | Red error `Alert` + **Retry** button. **AC-Inv-2.** |
| Post-success refresh failure | A poll fails after a prior success | The whole bundle stays on screen behind a soft warning: `Couldn't refresh — showing data from {age} ago. Retrying automatically.` **AC-Inv-2.** |
| Page isolation | Any Ticker error | The error renders inside the Ticker page's outlet slot only; it never blanks the nav shell or the other pages. **AC-Inv-2.** |
| Each nullable surface | Off-exchange / four metrics / ghost-trade / ai-rec / personas null | Each degrades to its own existing "unavailable this cycle"/empty copy, never throwing into the page or shell. **AC-Inv-6.** |

**Default / loading / live states (UNCHANGED, restated for completeness):** default = bundle rendered +
live chip `● live · {session} · ${mid}`; loading (cold) = `CircularProgress` (the cold spinner, NOT
"offline"); deep-link/symbol-change = navigate-on-Enter + one-shot DTE pre-fill still fire (the only edit
is the route prefix `/` → `/ticker/`, §1.3 / AC-Route-4 / AC-Live-5).

---

## 6. Relocated **Positions** page — standalone last-known-mark wording (Q2)

On `/positions` the portfolio is a **standalone page** (no Ticker-page parent supplying `live`/`data`).
It sources marks via the **existing `GET /api/contract`** mechanism with **degrade-to-last-known** (Q2,
ARCHITECTURE §4.3). UX owns the **degraded-mark wording** so a position is **never blanked or dropped**
(`[live-vs-static-isolation]`). The durable records, customization, and saved views always keep rendering.

| Degraded state | Trigger | Exact wording / treatment |
|---|---|---|
| Last-known mark (mark refresh fails) | Fetch/stream failure refreshing a position's mark | The position row stays listed; its mark/P-L cell shows the **last-known** value, dimmed, captioned `⏸ last known` (mirrors the Ticker `⏸ offline` idiom). **Never blank, never removed.** **AC-PosLive-2.** |
| Tracked contract not found (404) | `GET /api/contract` 404 for a tracked contract | Row stays listed with its durable facts (entry, qty, realized); mark/P-L cell shows `tracking unavailable` (muted). Not dropped, does not error the page. **AC-PosLive-3.** |
| No quote available (`option_quote: null`) | Contract exists but no NBBO quote | Row falls back to its honest mark (theoretical / last-known), captioned `no live quote` (muted); does not throw into the page. **AC-PosLive-4.** |
| Marks populate (default) | `GET /api/contract` succeeds | Current mark / P-L render normally (no caption). **AC-PosLive-1.** |
| Page isolation | Any positions-data failure | Degrades the affected row(s) only; the nav shell + other pages keep rendering. **AC-Inv-6.** |

**LOCKED Live tab (UNCHANGED — restate, AC-Inv-3 / `[no-real-order-path]`):** the **Live** tab stays the
**zero-import LOCKED placeholder** — `🔒 {LIVE_HEADING}` + lock chip + "coming soon / not connected" body
(existing `LiveTabPanel`, `labels.ts` constants). No broker, no order path, no real-position data source.
The relocation must NOT add any import or wiring to it.

**Everything stays SIMULATED (AC-Inv-4):** all positions/trades on the relocated Positions + Ticker pages
remain `SIMULATED` (paper); no real order/execution path is reachable.

### Component states — `Positions` (standalone)
| State | When | Treatment |
|---|---|---|
| default | Positions present + marks fresh | Table/card view, P/L, fills, grouping, saved views (all unchanged). |
| loading | Marks re-deriving on (re)mount | Per-row mark cells show the existing transient state while `GET /api/contract` resolves; durable facts render immediately (no whole-page spinner; records are read straight from the store). |
| empty | No positions in the durable store | Existing empty-state copy ("no simulated positions yet" — unchanged). |
| error / degraded | Mark refresh fail / 404 / null quote | Per-row `⏸ last known` / `tracking unavailable` / `no live quote` (above). Never blanks/drops a row. |
| offline | SSE/refresh drop | Same as degraded — last-known marks persist; durable records render. |

---

## 7. New-jargon glossary / tooltips (landing is plain-spoken for newcomers)

The relocated pages keep their existing rich tooltips (unchanged). The **landing** is for newcomers, so it
introduces at most one term that needs a plain gloss:

| Term (where it appears) | Plain-spoken tooltip / inline gloss |
|---|---|
| **Dealer gamma** (hero subhead, Ticker value-prop) | "How options dealers are positioned — it tells you where price tends to get pulled toward or pushed away from, and whether the market is likely to calm down or speed up." |
| **GEX** (Ticker value-prop, if used) | Prefer spelling it out as "dealer gamma" on the landing; if "GEX" appears, gloss: "Gamma exposure — the dealer-positioning structure Convexa maps for each ticker." |
| **SIMULATED / paper** (Positions value-prop, footer) | "Practice mode — positions and P/L are tracked for you, but nothing is sent to a broker and no real money moves." |

No new jargon is introduced by the nav, Scanner, or honesty sections. Operator/metrics terms never appear
on any trader-facing surface.

---

## 8. AC → component-state map  (THIS MAPPING IS THE REQUIRED-TESTS MATRIX)

Every AC in PRODUCT_CONTRACT §4 maps to ≥1 component state on ≥1 surface. The
FRONTEND_EXECUTION_CONTRACT "Tests to write" matrix (below) enumerates each as ≥1 named test — the FE
**implements** this set and never chooses it. (PRODUCT_CONTRACT §4 contains 42 ACs: Route 1–7, Nav 1–5,
Land 1–6, Live 1–5, Store 1–5, PosLive 1–4, Scan 1, Inv 1–9. The brief's "41" is an off-by-one count of
the same enumerated set; **all are mapped** below.)

| AC | Surface · component state(s) that satisfy it |
|---|---|
| AC-Route-1 | `Landing` default at `/` (renders brand+hook+value+CTA; **no** redirect to a ticker). |
| AC-Route-2 | `AppShell` default + `Ticker` default at `/ticker/TSLA`. |
| AC-Route-3 | `Ticker` default at bare `/ticker` → resolves default `TSLA`. |
| AC-Route-4 | `Ticker` default at `/ticker/AAPL` (deep-link, non-default symbol). |
| AC-Route-5 | `AppShell` default + `Positions` default at `/positions`. |
| AC-Route-6 | `AppShell` default + `Scanner` default at `/scanner` (static coming-soon). |
| AC-Route-7 | `OperatorMetrics` (own AppBar, outside shell) at `/_ops/metrics`; `AppShell` nav shows **no** link to it. |
| AC-Nav-1 | `AppShell` default present on `/ticker*`, `/positions`, `/scanner` (wordmark + 3 entries). |
| AC-Nav-2 | `AppShell` default → click `Positions`/`Ticker`/`Scanner` navigates + renders each page. |
| AC-Nav-3 | `AppShell` default → active-route indicator on the current entry. |
| AC-Nav-4 | `AppShell` persists (does not remount) across Ticker→Positions→Scanner→Ticker. |
| AC-Nav-5 | `Landing` default at `/` renders **no** trader nav shell (full-bleed). |
| AC-Land-1 | `Landing` hero default — Convexa wordmark + lead hook. |
| AC-Land-2 | `Landing` value-props default — Ticker/GEX, Positions sim, AI recs. |
| AC-Land-3 | `Landing` primary-CTA default → navigates into `/ticker` inside the shell. |
| AC-Land-4 | `Landing` secondary-CTA default → each value-prop CTA navigates to its in-shell route (no dead-end). |
| AC-Land-5 | `Landing` honesty-section: brokerage-connect resting + acknowledged states — coming-soon/waitlist, **not** a broker flow, no dead-end. |
| AC-Land-6 | `Landing` honesty-section / `AppShell` — Scanner presented as coming-soon (consistent with `/scanner`). |
| AC-Live-1 | `Ticker` default — entering opens exactly one EventSource for the symbol. |
| AC-Live-2 | `Ticker` → nav-away — the EventSource **closes** (no background stream, no leak). |
| AC-Live-3 | `Ticker` re-entry — a fresh EventSource opens (cold-start path), live resumes. |
| AC-Live-4 | `Ticker` round-trip — never two concurrent feeds for the same symbol. |
| AC-Live-5 | `Ticker` symbol-change (navigate-on-Enter) — prior feed closes, exactly one opens for the new symbol. |
| AC-Store-1 | `Positions` default — open a position, nav away+back, same position present (durable). |
| AC-Store-2 | `Positions` default — open a position, reload, still present (durable). |
| AC-Store-3 | `Positions` default — customization + named saved views persist across nav + reload. |
| AC-Store-4 | `Ticker`→`Positions` default — a position opened on Ticker is already present on `/positions` (same singleton store). |
| AC-Store-5 | `Positions` default + loading — ephemeral P/L trend sparkline + session delta re-derive on remount; durable P/L facts + the position persist (acceptable). |
| AC-PosLive-1 | `Positions` default — marks populate from `GET /api/contract`. |
| AC-PosLive-2 | `Positions` degraded — `⏸ last known` on refresh failure; never blanked/removed. |
| AC-PosLive-3 | `Positions` degraded — 404 → `tracking unavailable`; row stays, page doesn't error. |
| AC-PosLive-4 | `Positions` degraded — null quote → `no live quote` fallback; no throw into the page. |
| AC-Scan-1 | `Scanner` default — static coming-soon; **no** fetch/SSE/compute issued (observable). |
| AC-Inv-1 | `Ticker` offline/degraded — live tiles dim + `⏸ offline`, static bundle keeps rendering. |
| AC-Inv-2 | `Ticker` error states — cold-start = red error + Retry (only blank screen); post-success = soft "Couldn't refresh"; error does not blank shell/other pages. |
| AC-Inv-3 | `Positions` Live-tab state — zero-import LOCKED placeholder (no broker/order/data). |
| AC-Inv-4 | `Positions` + `Ticker` default — all positions/trades stay `SIMULATED`; no real-order path reachable. |
| AC-Inv-5 | `Ticker` default — tier/score readouts byte-identical pre/post relocation (scoring untouched). |
| AC-Inv-6 | `Ticker` + `Positions` — each nullable surface fails to its own unavailable/empty state, never throwing into page/shell. |
| AC-Inv-7 | `AppShell` + `OperatorMetrics` — `/_ops/metrics` stays off the shell, unlinked, read-only; nav doesn't reach it. |
| AC-Inv-8 | App root — exactly one router + one theme provider (no duplicate-router/theme console error; nav+deep-links+theming consistent). |
| AC-Inv-9 | `Positions` default — Convexa brand is UI-only; positions/views saved **before** the rebrand persist after (store key unchanged). |

---

## 9. Binding invariants restated (UX must not violate; FE inherits)

- **`[live-vs-static-isolation]`** — Ticker live tiles dim + `⏸ offline` (never blank), static keeps the
  last bundle (§5); Positions marks degrade to `⏸ last known` / `tracking unavailable` / `no live quote`,
  never blanking/dropping a position (§6).
- **`[best-effort-isolated-or-null]`** — every relocated nullable surface degrades to its own
  unavailable/empty state, never throwing into page or shell (§5/§6, AC-Inv-6).
- **`[additive-keeps-score-byte-identical]`** — pure restructure; no relocated feature becomes a scoring
  input; no UI feeds positions/marks into scoring (AC-Inv-5).
- **`[no-real-order-path]`** — everything stays `SIMULATED`; the Positions Live tab + Scanner + the
  landing "connect your positions" affordance are **non-functional placeholders** (coming-soon/locked),
  never a working broker/order path (§3.3, §4, §6, AC-Inv-3/4).
- **`[operator-vs-trader-path-separation]`** — `/_ops/metrics` stays off the product nav, unlinked,
  read-only; no nav/footer link to it (§2, AC-Inv-7).
- **Convexa brand is UI-only** — wordmark/copy on landing + nav only; no code/package/folder/durable-
  store-key rename (AC-Inv-9).
- **Honesty floor** — no CTA/affordance presents an un-built capability as working (§3.3, AC-Land-5/6).
- **Relocate-don't-change** — Ticker + Positions internals unchanged; UX designs only the new chrome +
  the degraded-state wording for the relocated surfaces.
- **Default-ticker UX** — bare `/ticker` → `TSLA`; symbol is a deep-linkable path segment;
  navigate-on-Enter + one-shot DTE pre-fill still fire on explicit symbol navigation.

---
---

# ===== COMPRESSOR #3 (Split Context) — EXECUTION FILES =====

The three execution files below are emitted from this blueprint. INTERFACE is the FE↔BE truth (here:
`NO_BACKEND_CHANGE`); BACKEND is the one-line stub; FRONTEND is the full build spec + Tests-to-write
matrix. They are also written as standalone files alongside this one.

(See `INTERFACE_CONTRACT.md`, `BACKEND_EXECUTION_CONTRACT.md`, `FRONTEND_EXECUTION_CONTRACT.md` in this
directory.)
