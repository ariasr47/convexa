# R1 — ux position: curvature-v2-foundations

> Canon: `.spire/clusters/tech/context/DESIGN_SYSTEM.md` **Status: SET — Curvature Terminal v2**
> (re-baselined 2026-09-03). This position is **subordinate** to it: I own states, copy and the
> register/liveness read *inside* that canon. I do not re-open the direction. Where I disagree with a
> drawing in `design/`, I say so and cite the shipped source, because the canon's own layer table ranks
> `design/site/library.html` as "**not** a second rulebook".

---

## Position

### 0. Who this is for, and the one job phase 1 buys

**Intended user.** A swing trader / operator reading dealer-gamma structure on a dark terminal, who
distrusts UIs that overclaim (canon, "What it is for").

**Primary job, stated as the user would state it:** *"Before I act on this number — is it ours, and is
it now?"* Today those two questions are answered by a **coloured left edge** and by **per-widget
convention**, which is why the same figure means different things on the Ticker and on Positions.

**What phase 1 is, in user terms:** every figure on every screen answers *register* ("is this
Convexa's?") and *liveness* ("is this now?") **in the same two places on the cell**, and the page's
single connection chip answers "why not?" in one closed vocabulary. Nothing moves. If a user can tell
that the desk was re-laid-out, phase 1 failed.

**Information structure — unchanged, with exactly one exception.** The desk, scanner, positions,
settings, alerts and landing keep their composition; `FigureCell` lands **in place** at every existing
`StatTile` call site (`LiveTape` 4 cells, `DealerPositioning` 11–12, `IvRank`, `MarketContext`,
`StraddleMove`, `DealerFlowProjection`). The **one** structural change the brief buys is the nav
(six links → four + ⌘K + session chip; Lab and Blog to the footer). No datum changes surface.

**User vocabulary (the words the product already speaks — do not invent synonyms):**
mid · last trade · call wall · put wall · gamma flip · max pain · net flow · spread · VWAP ·
IV/HV · IV rank · Vol/OI · IV skew · term structure · off-exchange · opportunity / tier ·
structure as-of · snapshot · session tape / replay · live · offline · overnight · closed.

---

### 1. Copy source of truth — the shipped string wins over the preview

`design/src/components/chip.mjs` and the generated `library.html` are **drawings with sample data**.
Where they and `apps/dashboard` disagree on a *string*, the shipped string is binding, because it is
already asserted by tests and already reviewed for honesty. Three divergences I rule on now:

| Divergence | Preview | Shipped | Ruling |
| --- | --- | --- | --- |
| Currency on the mid | `mid 573.12` (`chip.mjs:27`) | `mid $573.12` (`TickerHeader.tsx:250`) | **Keep `$`.** A bare number beside a symbol is ambiguous at a glance. |
| Overnight names the mid | `overnight — no live data` (`chip.mjs:28`) | `○ overnight — no live data · mid $573.12` (`TickerHeader.tsx:275`) | **Keep the mid.** Naming the number the page is actually showing is what stops the chip being a bare scold. |
| `⏸` / `○` / `⚠` characters | literal glyphs | literal glyphs in strings asserted at `ticker.risk.spec.tsx:327`, `positions.integration.spec.tsx:497`, `day-replay-mock-adapter.spec.tsx:111-116` | **Swap to the stroke icons** per canon Tokens §Icons — but **only inside `FigureCell` and the connection chip this phase.** `PositionRow`/`OrderRow`/`BrokerPositionRow` keep their literal `⏸` until their own phase, or phase 1 silently re-writes three screens it was told not to touch. |

---

### 2. `FigureCell` — the complete state matrix

Nine states. Each row names what the user sees, what they can do next, and **what must not happen**.
"Value" = the figure slot; "Label row" = caps label · ⓘ · liveness slot; "Caption" = the line beneath.

| # | State | Label row | Value | Caption | Must NOT happen |
| --- | --- | --- | --- | --- | --- |
| F1 | **Default (static figure)** | caps label · ⓘ · **no dot** | Plex **Mono** 20px, `phosphor` | the cell's own basis line (e.g. `+1.20% from mid`) or none | No dot. No "snapshot" badge — see §4. |
| F2 | **Loading (cold skeleton)** | shimmer block at label height | shimmer block at figure height | shimmer block at caption height | Must **never** appear after the first successful load; must carry no text at all (no "Loading…", no `—`). |
| F3 | **Live-updating** | caps label · ⓘ · **live dot chip** (11px, `signal` tone) | Mono, flash-on-tick 700ms decaying to `phosphor` | basis line | The dot may not render unless *this figure's* value came from a delivering stream. A dot on a snapshot figure is the failure canon rule 22 exists to stop. |
| F4 | **Offline — value retained** | caps label · ⓘ · **no dot** | last received value, **Mono, 50% opacity**, pause icon before it | `offline · last known` | The `last known` clause may **only** render when the cell is showing a value that actually arrived before the drop. |
| F5 | **Offline — no value retained** | caps label · ⓘ · no dot | the `—` literal, **Sans 15px**, 50% opacity, pause icon | `offline` (bare) | Must not say `last known` beside a `—`. See §8.2 — this is today's real behaviour and the copy must match it, not the drawing. |
| F6 | **Replay / not-current (session tape)** | caps label · ⓘ · **no dot** | Mono, **full strength** | `session replay` (+ the armed symbol and date at panel level) | No live dot, no pause mark, no `offline` caption. `LiveTape.spec.tsx:269` already pins "S1 drop does not show ⏸ offline" — keep it. |
| F7 | **Empty / not applicable** | caps label · ⓘ | `—`, **Sans 15px**, `steel` | optional one-liner naming *why it does not apply* | `—` must never be prefixed or suffixed by a unit. See §8.3. |
| F8 | **Unavailable (attempted, failed this cycle)** | caps label · ⓘ | `unavailable`, **Sans 15px**, `steel` | `this cycle · never a fake zero` (or the widget's existing `… unavailable this cycle.` line) | Must be distinguishable from F7 in the DOM, not only to the eye — `[absent-is-not-none]`. Never `0`, never blank, never `null`/`NaN`. |
| F9 | **Untraced (asserted, not traced)** | caps label · ⓘ | **Plex Sans** 500 at figure size, **dotted rule beneath** | names the asserter, e.g. `AI-stated · untraced` | **No phase-1 call site may emit this.** The prop exists so phases 2–4 compose; a Sans figure rendered where no grounding state exists is a fabricated provenance claim. |

**Container steps (independent of viewport, canon Tokens §Breakpoints):**

| Panel inline width | Figure | Caption | Label / chips |
| --- | --- | --- | --- |
| ≥ 360px | 20px Mono | 11px | 11px caps |
| < 360px | **17px** Mono | 11px | 11px caps |
| < 280px | **15px** Mono | **11px — the floor, not below** | 11px caps |

`design/src/lib.mjs:29-30` already writes exactly this and correctly stops the caption at 11px rather
than scaling it down. Nothing in the ladder may go below 11px (canon Banned: "Chip/label text < 11px").
A literal (F5/F7/F8) is **already** 15px Sans and does **not** step further at 280 — it is not a figure.

**State exclusivity (the assertion that matters):** F2 ≠ F5 ≠ F7 ≠ F8. A cold skeleton is not an
offline state; an offline dim is not an unavailable; an `unavailable` is not a `—`. This is
`[live-vs-static-isolation]` + `[absent-is-not-none]` in one component, and it is the thing that
regresses silently.

---

### 3. The connection chip — exactly six states, and why a seventh is unnecessary

One chip per page (canon rule 18). Binding labels, taken from the shipped resolver
`TickerHeader.tsx:246-342`, with the glyph moved to a stroke icon:

| State | Exact label | Tone | Leading mark | Dot pulse | Visible difference in one sentence |
| --- | --- | --- | --- | --- | --- |
| **live** | `live · {open\|pre-market\|after-hours\|overnight} · ${mid}` | `signal` tint | filled dot | **yes** — only while genuinely live **and** `prefers-reduced-motion` is off | The only state with a moving dot, and the only one that names the session as an active thing. |
| **closed** | `market closed · mid ${mid}` | **neutral** (never warning) | hollow ring | no | Neutral grey: nothing is wrong, the venue is shut. |
| **overnight** | `overnight — no live data · mid ${mid}` | warning + **icon** | warn icon | no | Burnt orange: we are *inside* a session window our vendor does not cover. |
| **no ticks** | `no live ticks · mid ${mid}` | warning + **icon** | warn icon | no | Burnt orange: covered session, connection up, nothing arriving — the feed is lagging. |
| **offline** | `Live offline — reconnecting…` | warning + **icon** | warn icon | no | The only state that does **not** name a mid, because the connection — not the venue — is the subject. |
| **replay** | `replay · {SYMBOL} {Wed Sep 2}` | **outline** | hollow ring | no | The only outlined chip; it names a *stored session*, which is what makes it not a liveness claim. |

**Why no seventh is needed.** The six close over two orthogonal questions and one provenance question:
*(a) is a stream connected to us?* → `offline` vs everything else. *(b) is the venue producing ticks?*
→ `live` / `closed` / `overnight` / `no ticks`. *(c) is the source the venue at all?* → `replay`.
Every candidate seventh collapses:

- **"connecting…" / "loading"** — not a connection state. Before the first stream fact the resolver
  returns `null` and **no chip renders at all** (`TickerHeader.tsx:329`). That absence is correct and
  is **not a seventh state**: it is the absence of a claim we cannot yet make. Adding a "connecting"
  chip would make a cold skeleton into an offline state, which the brief's invariant watch forbids
  verbatim. **A "connecting" chip is the seventh state, and it is banned.**
- **"stale"** — a freshness claim about the *structure snapshot*, not the stream. It already lives in
  the panel head (`structureAsOfPhrase`, `withStructureAge` in `_kit/copy.ts:515-529`). Putting it on
  the chip would be a second freshness authority.
- **"degraded" / "partial"** — unfalsifiable middle ground. Either a tick arrived or it did not.
- **"delayed feed"** — a property of `live.feed`, already named in the live tip
  (`Streaming live {feed} ticks.`), not a separate connection condition.

**Enumeration is the test.** The chip resolver must be exhaustive over a closed union and a state test
must prove no seventh is reachable — including the `null` (no-chip) arm, which must be asserted as
*absence of a chip*, not as a state.

---

### 4. Where the register and the liveness read live — and what "no" looks like

This is the whole point of the phase, so it is specified as a location, not a principle.

| Question | Where it is answered | "Yes" | "No" |
| --- | --- | --- | --- |
| **"Is this number ours?"** | **In the glyphs of the value itself** — the face is the answer. | **IBM Plex Mono**, tabular, aligned in its column. | **IBM Plex Sans** at the same size with a **dotted rule** beneath, and a caption naming who asserted it. It visibly stops lining up with the column — that misalignment is a *second honest signal*, ruled in knowingly (canon Amendment 2026-08-13). |
| **"Is this live?"** | **The label row, immediately right of the ⓘ** — one slot, same x-position on every cell on every screen. | An 11px `signal`-tinted dot chip that pulses at 1.6s. | **Nothing in the slot.** Absence is the answer. |
| **"…and if it *was* live and stopped?"** | The same label row + the value + the caption. | — | Value dims to 50% with a pause icon; caption reads `offline · last known` (F4) or `offline` (F5). |

**Two rules that follow, and that I will defend hard:**

1. **Absence, not a badge.** A static figure gets **no** "snapshot" chip. If every static cell wore a
   provenance badge, the live dot would stop being a signal — it would be the odd one out in a field
   of badges. The basis and the age already live once, at the panel head, per spine #4. **One
   freshness authority per panel, one liveness authority per page.**
2. **The dot is per-figure, not per-widget.** `VWAP` sits inside the "Live tape" widget
   (`LiveTape.tsx:163-168`) and is a bundle read with **no** `offline` prop. It must not get a dot
   just because its neighbours have one. The widget's own `livebar` is a *widget* claim; the dot is a
   *figure* claim; the chip is the *page* claim. Three scopes, never merged.

**Which figures may render in Mono (Convexa's own, traced):** every figure produced by our engine or
our client math from a vendor input — call/put wall, gamma flip (static and live), max pain, net GEX,
vol-norm GEX, net DEX, IV/HV, IV rank, chain Vol/OI, IV skew, term structure, VWAP, net flow, spread,
mid, last trade, distances-to-level, ATR, P/L, marks, scores. That is **every figure on every surface
phase 1 touches**.

**Which must render in Plex Sans (asserted, untraced):** only a number an AI read **asserted** that did
not trace to a bundle field — which exists today on the AI-rec card and the entry dialog only, and
**nowhere phase 1 re-points**. Therefore: **`FigureCell` must expose `register`, and every phase-1 call
site must pass mono.** A Sans figure appearing on the desk in phase 1 is a defect, not a feature — it
would assert a grounding state that surface does not have.

---

### 5. Navigation — states, and one thing I am removing

**Links (four, in this order):** Scanner · Ticker · Positions · Alerts. Lab and Blog move to the
footer. **No `/_ops/metrics` or `/_ops/research` entry in the bar, the burger, the footer, or the
palette** — `[operator-vs-trader-path-separation]`.

| # | State | What the user sees |
| --- | --- | --- |
| N1 | Default link | `steel` label, 600 weight, no underline. |
| N2 | **Active link** | `phosphor` label + a 2px amber underline on the bottom edge, **and `aria-current="page"`**. Colour alone is not the state. |
| N3 | Hover / focus | Hover → `phosphor`. Focus → the one authored theme ring (§7), never a bespoke ring. |
| N4 | **< 900px — burger** | Links collapse behind a labelled burger (`aria-label="Open navigation menu"`) opening a drawer whose links unmount when closed. Wordmark, search affordance and session control stay in the bar. |
| N5 | **< 1100px — search collapses** | The `Jump to a ticker…` field becomes a search **icon button** with an accessible name. The ⌘K hint text drops with the field; the shortcut still works. |
| N6 | **Signed out** | `Log in` (ghost) + `Sign up` (primary pill). No avatar. No claim about saved state. |
| N7 | **Session chip** | 30px amber avatar with the account initial, `aria-label="Account settings"`. It is a *link to settings*, not a status. |
| N8 | Session loading | The shipped `AccountControl` non-blocking read; the bar renders regardless. Never a spinner that blocks the page. |

**What I am removing from the drawing, and why.** `design/src/lib.mjs:211` puts a **`chip live` with a
pulsing dot** in the nav: `Open 10:42:07 ET`. On the Ticker page that renders a **second pulsing
liveness claim on the same page as the connection chip** — precisely what canon rule 18 says "is the
failure this rule exists to stop." It also survives onto Scanner and Positions, which have no live
stream at all, wearing a live tone. The brief's nav enumeration is "wordmark + four product links + a
⌘K command palette + session chip" — **no clock, no bell**. My ruling: **phase 1 ships no nav clock and
no nav bell.** If the owner wants the clock later it returns as a **neutral** chip with **no dot**,
labelled `Market open · 10:42 ET`, and it is a *venue* clock, not a *stream* claim.

---

### 6. ⌘K command palette — states and the copy I refuse to write

| # | State | What the user sees / can do |
| --- | --- | --- |
| P1 | **Closed** | The nav shows the affordance only: `Jump to a ticker…` + a `⌘K` kbd pill (11px mono). Under 1100px, a search icon button. |
| P2 | **Open — empty query** | Dialog over the `scrim` token at z-index 40. Input focused. Body shows **recent tickers** (client-local) then the tracked-universe default view. Footer helper row: `↑↓ move` · `↵ open ticker` · `esc close`. Never an empty white box. |
| P3 | **Typing** | Results filter as a **prefix-then-substring match on the symbol**. The first row is pre-selected and `aria-activedescendant` points at it. |
| P4 | **No results** | One line, not a blank list: **`No tracked symbol matches "{query}".`** plus a single action **`Open {QUERY} anyway →`** when the query is a plausible ticker. It must say *tracked*, because "no results" here means "not in the scanner universe", **not** "this ticker does not exist". |
| P5 | **Keyboard-only** | ⌘K / Ctrl-K opens from anywhere in the shell. ↑↓ move, ↵ opens, ⇧↵ adds to the scan view, Esc closes. Focus is trapped while open and **returns to the element that opened it** on close. Every result is reachable without a pointer. |
| P6 | **Dismissed** | Esc, scrim click, or route change closes it. Query is discarded (not remembered). Focus restored. No toast. |

**Copy I will not write, with the reason.** The drawing at `design/src/screens/library-page.mjs:147`
renders results as `NVDA — NVIDIA · Prime · 88` and `NVDL — GraniteShares 2x NVDA · not in universe`.

1. **Company names have no source.** `apps/api/config/universe.json` is a **bare symbol array** — 69
   strings, no names (`universe.json:3-21`). There is no name field on `ScanRow` either. Rendering
   `NVIDIA` beside `NVDA` would be a label with **no vouched source**. **The palette renders symbols
   only** until a name field exists. This is a `[cited-code-is-verified-not-assumed]` call: I read the
   file.
2. **Tier and score must carry their status, not float free.** `ScanStatus` is a closed
   `'ok' | 'stale' | 'error' | 'building'` (`libs/api/src/lib/convexa.ts:1143`). A row that is
   `building` has no score yet; a row that is `error` failed. **A score renders only for `ok`;
   `stale` renders the score with the sweep age beside it; `building` renders `—`; `error` renders
   `unavailable`.** A blank or a `0` in that column is a fabricated claim, and the palette is the
   worst place to make one because it is the *pre-decision* surface.
3. **`not in universe`** stays as a caption and means exactly *"not in the scanner's tracked
   universe"* — never "not tradeable", never "no data". It renders in `steel`, never in warning.

---

### 7. Accessibility, as design

**Already shipped at the theme layer — do not fork it.** `shared/theme/theme.ts:80-102` defines the one
authored `*:focus-visible` ring (2px text-grade amber, 2px offset, plus the `.MuiButtonBase-root`
pair that defeats MUI's `outline: 0` reset) and the `@media (pointer: coarse)` 44px `minHeight`/
`minWidth` floor on `button, [role="button"], a`. Every new surface this phase adds — the palette
dialog and its rows, the burger drawer, the connection chip if it becomes interactive, the ⓘ button —
**inherits these**. A bespoke ring on any new component is a defect, and `outline: none` without a
replacement is a red build (canon rule 6).

**The 11px floor** applies to the caps label, the live-dot chip, the connection chip, the `kbd` pills
and the figure caption — including at the 280px container step (§2). The existing `type-floor.spec.tsx`
source scan already enforces this repo-wide with a live exemption list; the amendment this phase needs
is the **container-step assertions**, not a weakening of the floor.

**Hover-revealed controls — one shipped violation I am closing.** `StatTile.tsx:180-183` wraps the
**whole tile** in a hover `Tooltip`; the ⓘ is decorative. On a touch device there is no hover, so the
entire glossary body — every `netDexTip`, `skewTip`, `termTip`, `MC_TIP_*`, `IVR_TIP_*` string in
`_kit/copy.ts` — **is unreachable**. That is canon rule 20 and the Banned row "Hover-only affordances",
failing today. **`FigureCell`'s ⓘ must be a real focusable control** (a button with an accessible name
of the form `About {label}`) that opens the same copy on tap and on Enter/Space, and closes on Esc.
Hover on the tile may stay as the *enhancement*; it may not be the only path.

**`prefers-reduced-motion` — what each data signal degrades to.** Motion stops; **the claim does not.**

| Signal | Reduced-motion result |
| --- | --- |
| Live dot pulse (1.6s) | Dot renders **static and fully opaque**. Liveness is still stated. |
| Widget live bar pulse (2.8s) | Static bar at its resting opacity. |
| Flash-on-tick (700ms) | No colour transition at all — the figure simply updates. Not a colour hold that leaves green/red text behind, because green/red are reserved for direction. |
| Skeleton shimmer | Static block at the mid tone. Loading is still visually distinct from empty. |
| Field drift / tape trail / mid beam | Not rendered. |
| Bottom sheet (320ms) | Snaps open/closed. |

The gate is `useReducedMotion` (`shared/hooks/useReducedMotion.ts`, already shipped and specced) —
**not** a global `animation: none` sweep, because a global sweep would also kill the sheet's focus
management and cannot make the dot stay opaque.

**What a screen reader announces on a connection-chip state change.** Today: **nothing** — there is no
`aria-live` region anywhere in the chip path (verified: `aria-live` appears in `OrdersWidget`,
`OrdersPanel`, `FaultedBanner`, `ScanToolbar`, `Landing`, `StateExportDrawer`, and nowhere near
`TickerHeader`). This phase adds **exactly one** visually-hidden `aria-live="polite"` region per page,
owned by the connection chip — mirroring "one chip per page" so a second region cannot appear.

- It announces **only on a state transition**, never on a tick, never on a mid change.
- The announcement is the chip's own sentence, expanded so it stands alone out of context:
  - live → `Live stream connected. Market open. Mid 573.12 dollars.`
  - offline → `Live stream offline. Reconnecting. Structure levels are still current.`
  - closed → `Market closed. Showing the last completed session. Mid 573.12 dollars.`
  - overnight → `Overnight session. No live data from the provider. Mid 573.12 dollars.`
  - no ticks → `No live ticks arriving. The feed may be lagging. Mid 573.12 dollars.`
  - replay → `Session replay. SPY, Wednesday September 2. Not a live feed.`
- `polite`, never `assertive`. A feed drop is not an interruption of the user's task.
- The chip itself carries `role="status"` **or** the region does — **not both**, or the transition
  double-announces.

---

### 8. What must NOT change — and the four places where swapping the primitive changes *meaning*, not look

**Must not change:** no screen re-layout; the desk, scanner, positions, settings, alerts and landing
keep their composition; no widget moves, merges, splits or is retitled; no tooltip body text is
rewritten; no figure changes its formatter; `apps/api` diff is empty.

These four are places where a naive `StatTile → FigureCell` swap is **information loss**, not restyling:

**8.1 — Call wall / Put wall lose their only call-vs-put encoding.**
`DealerPositioning.tsx:105` and `:112` pass `accent="up"` / `accent="down"`. On a **gamma/GEX surface**
that green/red is legitimately **call-vs-put** (ruling #18, quoted in the canon's Banned table). It is
the *only* place those two tiles are distinguished by anything but their label. Deleting the bar makes
`Call wall $580.00 · +1.20% from mid` and `Put wall $560.00 · −2.3% from mid` visually identical, and
the `+`/`−` in the caption is **distance from spot**, not the wall's identity. **Replacement required
in phase 1:** the wall's side must remain encoded by something that survives a black-and-white
screenshot — my proposal is the **ladder tick stroke style** the canon already commits to (rule 14:
"Each row's tick uses the same stroke as its line in the structure field"), applied as a small
leading tick on the cell. If the council does not want to introduce a tick in phase 1, the fallback is
to keep the caption but change the label to `Call wall (resistance)` / `Put wall (support)` — worse,
but honest. **What is not acceptable is silently dropping the encoding.**

**8.2 — The offline caption asserts a value that today does not exist.**
Canon rule 13 says offline "keeps the **last known value** at 50% opacity with a pause marker", and
`design/src/screens/desk-states.mjs:40` draws `⏸ offline · last known` beside `+12,480`. But
`LiveTape.tsx:78` computes `netFlow = numbersActive && live ? live.net_flow : null` and `:148`
computes spread the same way, with `numbersActive = isLive && !streamOffline` (`:73`). **On a drop,
Net flow and Spread render `—`, not a last-known figure.** (`ticker.risk.spec.tsx:322` *comments*
"last-known value RETAINED" but only asserts the `⏸ offline` caption and the last-trade line — it does
not assert those two figures.) So a literal reading of the canon would print **`— · ⏸ offline · last
known`**: a caption asserting a value the data does not support. That is my defining failure mode,
and I will not write it.

**My ruling:** the `· last known` clause is **data-driven, not decorative** — F4 vs F5 in §2. Whether
`LiveTape` should start *retaining* the pre-drop value (making F4 the real state) is a **behaviour
change**, and behaviour changes belong to the PM and the owner, not to me. I flag it as an R2
`product` question and I am content either way; what I am not content with is a caption that outruns
the data.

**8.3 — `$—` is already being rendered, and `FigureCell` must not inherit it.**
`DealerPositioning.tsx:150` is `` value={`$${m.max_pain ?? '—'}`} ``. When `max_pain` is null this
renders **`$—`** — a dollar sign attached to a not-a-number literal, which asserts "a dollar amount we
cannot show" where the truth is "there is no max-pain strike this cycle". Under §2 the literal must
render as **bare `—` in 15px Sans**, never in the figure register and never carrying a unit. Same
audit needed on every `` `$${…}` `` template at a `StatTile` call site.

**8.4 — the Opportunity tile's tier emphasis lives entirely in the accent bar.**
`DealerPositioning.tsx:211-212` passes `accent="neutral"` + `accentColor={tierColor}`. The bar is the
only tier emphasis; the tier *word* is already in the value string
(`` `${opportunityScore} · ${tierWord}` ``). Deleting the bar loses emphasis but **not meaning** —
acceptable in phase 1, provided the amber moves onto the **tier word itself** (the canon's "amber is
spent, not sprinkled") rather than being dropped. The ring gauge in the drawing is phase-2 read-strip
work and is **out of scope here**.

**8.5 — a canon-vs-code discrepancy I must report rather than paper over.**
Canon rule 24 states the closed not-a-number vocabulary is six members and "a seventh member is an
**Amendments** event". The shipped app already renders **three more**: `not recorded`
(`features/trading/positions/view.ts:47`), `no basis` (`features/trading/positions/labels.ts:126`),
and `not provided` (`features/trading/broker/brokerView.ts:146`) — and `[absent-is-not-none]` in
`PROJECT_CONTEXT.md` §5 explicitly cites `not recorded` / `no basis` as canonical. **I am not inventing
a seventh; I am reporting that at least nine exist.** The consequence for this phase is concrete: if
`FigureCell` implements the six as a hard runtime allow-list (as
`design/src/components/figure-cell.mjs:14` does), then in phase 3 `not recorded` and `no basis` will
fall through to the **mono figure register** on the positions surface — i.e. a not-a-number string
rendered in the "this is Convexa's computed figure" face. That is the exact inversion the register
exists to prevent. **`FigureCell` must classify the literal from the caller (or from a shared exported
union), not from a hardcoded six-member `Set`.** Reconciling rule 24's list is an **Amendments** event
for the owner — I raise it as an R2 `product` conflict, not a local decision.

---

### 9. AC → state map, with `Verify by` marks

ACs are the PM's to write. What follows is my binding **state → required coverage → method** map: for
whatever AC the PM writes covering the left column, it lands on the named state(s) and carries the
named mark. Rule applied (`spire-tech-risk-based-verify` step 2): *would a human notice this breaking
on a normal pass?* Invisible or negative-space → `test`; visible and intentional → `review`.

| Behaviour the AC must cover | State(s) | Verify by | Why |
| --- | --- | --- | --- |
| No coloured accent edge on any figure cell, anywhere | F1–F9 | **test** | Negative space. A re-added bar looks fine and regresses the whole rule. Source scan + render assert. |
| `⏸`/pause marker renders **only** in F4/F5 | F1–F9 | **test** | Silent both ways — always-on and never-on both look plausible. |
| Cold skeleton never appears after first load; F2 ≠ F5 ≠ F7 ≠ F8 in the DOM | F2, F5, F7, F8 | **test** | Four states that collapse into each other invisibly. This is the `[live-vs-static-isolation]` + `[absent-is-not-none]` core. |
| A closed-vocabulary literal renders in **Sans at 15px**, never in the mono figure register | F5, F7, F8, F9 | **test** | A register inversion is invisible in a green suite and is the fabrication this phase exists to prevent (§8.5). |
| Live dot renders **only** when the value came from a delivering stream | F1, F3, F6 | **test** | A dot on a snapshot is the canon's named honesty failure. |
| No phase-1 call site emits the Sans/untraced register | F9 | **test** | Negative space; a fabricated provenance claim. |
| The container-query rules are declared (20 → 17 → 15 at 360/280) | F1–F9 | **test** | Assert the declaration. |
| The *rendered* figure size at 360px / 280px panel width | F1–F9 | **review** | jsdom does not evaluate container queries (skill step 4, stack limit). Either review, or e2e if the suite gains container-width cases — do not fake it with a unit test. |
| The connection chip has **exactly six** reachable states and **no chip at all** before the first stream fact | chip C1–C6 + absence | **test** | Exhaustiveness over a closed union; the seventh state ("connecting…") is the failure mode. |
| Exactly one connection chip and one `aria-live` region per page | C1–C6 | **test** | A second liveness claim is invisible until someone reads two chips. |
| The warn icon is present on `overnight` / `no ticks` / `offline` | C3, C4, C5 | **test** | `warning-icon.spec` — hue-alone warning fails a B/W screenshot. |
| Dot pulses only when genuinely live **and** reduced-motion is off | C1 | **test** | Motion that dies under refactor; and a pulse under reduced motion is an accessibility regression nobody sees. |
| The exact chip labels and tips | C1–C6 | **review** | Copy wording — intentional and visible. |
| The SR announcement fires on transition only, `polite`, once | C1–C6 | **test** | Double-announce and never-announce are both silent to sighted review. |
| The SR announcement **phrasing** | C1–C6 | **review** | Copy. |
| Nav shows exactly four product links; Lab/Blog absent from the bar; **no `/_ops` link anywhere** including the palette | N1–N4, P2–P4 | **test** | `[operator-vs-trader-path-separation]` — negative space, and a leak is a real exposure. |
| Nav carries **no live-toned chip and no pulsing dot** | N1–N8 | **test** | Negative space; this is the §5 removal and it will be re-added by anyone following the drawing. |
| Active link carries `aria-current="page"` | N2 | **test** | Invisible to sighted review. |
| Burger appears < 900px; search collapses < 1100px | N4, N5 | **review** | Visible and intentional; the e2e width sweep already catches overflow. |
| Signed-out vs session-chip rendering | N6, N7 | **test** | Already covered by the shipped `AccountControl` path; an anonymous user seeing an account affordance is a claim failure. |
| ⌘K / Ctrl-K opens from anywhere in the shell; Esc closes and **restores focus to the invoker** | P1, P5, P6 | **test** | Focus restoration is the classic silent regression. |
| Palette renders **no company name**; symbol-only | P2–P4 | **test** | Negative space; an unsourced label. |
| A `building` row renders `—`, `error` renders `unavailable`, `stale` renders the score **with its age** | P3 | **test** | Fabricated-score risk on the pre-decision surface. |
| No-results copy present (never a blank list) | P4 | **review** | Visible copy. |
| Helper-row shortcut hints and result ordering | P2, P3 | **review** | Intentional and visible. |
| ⓘ opens its copy by tap and by keyboard at every breakpoint | F1–F9 | **test** | Canon rule 20; a hover-only path is invisible to a desktop reviewer with a mouse. |
| Reduced motion: dot stays visible and opaque; shimmer static; flash removed | F2, F3, C1 | **test** | "Motion off" that also removes the *claim* is the regression. |
| No horizontal overflow at **393 / 834 / 900 / 1280**, both schemes | all | **test** | e2e; the brief's own observed-when. |
| Zero new hardcoded hex with the seven token additions bound | all | **test** | `hex-discipline.spec` / `banned-hexes.spec`. |

---

## Risks I see

1. **The drawing gets treated as the rulebook and the shipped copy is silently rewritten.** The largest
   copy risk in this phase is not a bad new string — it is `library.html` being pasted over
   `TickerHeader`'s reviewed strings, losing the `$`, the mid on the overnight chip, and the long
   honest tips in `_kit/copy.ts`. §1 exists to stop that; it needs to be in the SPEC, not just here.

2. **`— · ⏸ offline · last known`.** If §8.2 is not settled, the most likely build outcome is a caption
   asserting a retained value beside a dash. It will pass every test in the current suite.

3. **The register becomes invisible in practice.** Mono-vs-Sans only reads as a signal if Sans figures
   are *rare*. If any phase-1 surface starts emitting the Sans register "because the prop exists", the
   distinction dies before phase 2 needs it.

4. **The nav clock returns.** It is in the canon's own generated drawing (`lib.mjs:211`) with a `live`
   tone and a pulsing dot. Anyone implementing from the drawing rather than from §5 will re-add a
   second liveness claim, and it will look correct.

5. **The `⏸` glyph swap bleeds outside `_kit`.** `positions.integration.spec.tsx:497`,
   `ticker.risk.spec.tsx:324`, `day-replay-mock-adapter.spec.tsx:111-116` and
   `BrokerTabPanel.spec.tsx:301` all assert the literal character. A global find-and-replace makes four
   screens change wording in a phase that promised not to touch them.

6. **The wall accent removal ships as pure deletion.** §8.1 is the one case in this phase where "no
   accent bar" costs the user information. It is easy to miss because the tiles still look fine.

7. **The 11px floor gets breached at the 280px container step.** The pressure to shrink the caption
   with the figure is real; `lib.mjs:30` resists it correctly. `type-floor.spec` must gain the
   container-step case or nothing catches it.

8. **The ⓘ stays hover-only.** Fixing it means changing an interaction on ~20 tiles across five
   widgets, which reads like scope creep against "no screen changes". It is not scope creep — it is a
   shipped accessibility failure the canon already bans — but it will be argued.

9. **`aria-live` double-announcement.** Putting `role="status"` on the chip *and* adding a region is
   the default mistake, and it is only detectable with a screen reader or a targeted test.

10. **`unavailable` and `—` collapse under the new type ramp.** Both render as 15px Sans `steel`. They
    are distinguished only by their *word*. If any implementer "tidies" them to a shared placeholder
    component with a single default, `[absent-is-not-none]` dies quietly.

11. **The palette becomes a mini-scanner without a freshness claim.** The drawing's note says the
    palette "doubles as a mini scanner". A tier and a score with no as-of, over a sweep side-store, is
    a liveness claim by omission.

---

## Assumptions I'm making about the other two lanes

1. **PM's ACs will be written against my nine `FigureCell` states and six chip states by name**, not
   against a shorter "default / loading / error" triad. If the PM's AC list has fewer than four
   distinct not-a-number/degraded rows for `FigureCell`, my state matrix and the PM's ACs disagree and
   I will raise it as a conflict in R2.

2. **PM prices the ⓘ hover→tap/focus fix as in-scope for phase 1** (canon rule 20 + Banned
   "Hover-only affordances"). If it is deferred to a later phase, phase 1 ships a `FigureCell` that
   still hides every glossary string from touch users, and I will contest the deferral.

3. **PM rules on §8.2 (whether `LiveTape` retains the pre-drop value) as a product question.** I assume
   the PM will answer explicitly rather than leave the caption's `last known` clause to the build lane.
   If the PM says "retain", that is a behaviour change and needs its own AC; if the PM says "do not
   retain", F5 is the binding offline state for Net flow and Spread.

4. **PM has not scoped a nav clock or a nav bell into phase 1.** The brief's nav enumeration names four
   links, ⌘K and a session chip. If the PM's ACs include a clock chip, we conflict on canon rule 18
   and I will quote it.

5. **PM keeps the read strip, the level ladder, the AI read brief and the structure-field hero out of
   phase 1.** I have written no states for them. If any AC references a read strip, the state matrix is
   incomplete by that AC's own construction.

6. **Architect will expose a per-figure liveness fact, not a per-widget one.** I assume `FigureCell`
   receives something equivalent to "this value arrived from a delivering stream" for *this figure*.
   If liveness is only available at widget granularity, `VWAP` inside the Live tape widget gets a dot
   it has no right to (§4.2) and the whole per-figure read collapses. This is the single assumption
   most likely to be wrong.

7. **Architect will expose "a value was received before the drop" as a distinguishable state from "no
   value".** Without it, F4 and F5 cannot be told apart and the caption cannot be data-driven.

8. **Architect keeps the closed-literal classification out of a hardcoded six-member set** and lets the
   caller declare it (§8.5). If the architect's design mirrors `figure-cell.mjs:14`'s `Set`, phase 3's
   positions surface will render `not recorded` in the mono figure register.

9. **Architect treats the seven token additions as landing in `tokens.ts` first**, so no component in
   this phase reads `design/tokens/tokens.json` at runtime and no hex is hardcoded. My copy and state
   work assumes `steel2`, `line`, `line2`, `ink2`, `scrim`, `glass`, `raised2` are theme-resolvable in
   both schemes before any `FigureCell` markup lands.

10. **Architect will keep the connection-chip resolver as one pure, exhaustive function over a closed
    union** (the shape `TickerHeader.tsx:292` already has), so "exactly six, no seventh" is testable by
    enumeration rather than by rendering six screenshots. If the resolver becomes a chain of `if`s
    across components, the seventh state becomes reachable and unprovable.

11. **Architect will not add a new dependency for ⌘K without pricing the accessibility work it does
    *not* give us.** Focus restoration to the invoker, `aria-activedescendant`, and Esc-without-
    swallowing are my requirements either way; `cmdk` vs MUI `Dialog` is the architect's call, but the
    P5/P6 behaviours are not negotiable and are not free in either option.

12. **Both lanes accept that `apps/api` is untouched**, so every field my copy references
    (`ScanStatus`, `sweep` metadata, `live.market_session`, `live.feed`, `session_tape`) is consumed as
    it exists today. If either lane proposes a new field, my palette and chip copy need re-checking
    against it before R4.
