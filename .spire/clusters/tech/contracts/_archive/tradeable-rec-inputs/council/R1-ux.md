# R1 — ux position: tradeable-rec-inputs

## Position

### 0. Who this is for, and what it must not become

**Intended user:** the owner-operator swing trader already living on `/ticker/:symbol` — signed in
(the AI rec is auth-outermost today), reads dealer gamma structure, distrusts UIs that overclaim.

**Primary job:** *"the AI gave me a read — can I act on it, and at what size?"* Today the answer is
structurally unanswerable: `max_risk`, `position_size`, `exit_plan.target` and `exit_plan.stop` all
render `s.max_risk ?? '—'` in `AiRecPanel.tsx:897/932/933/937`, and a single em-dash currently means
four different things at once.

**The job is NOT** "browse the option chain," and it is NOT "size a position for me." Both are one
design decision away and both are wrong here — see §5 and §7.

**User vocabulary** (what the trader already reads in this app): *max risk · invalidation · target ·
stop · suggested size · no trade · as of · stale · SIMULATED · unavailable this cycle · not recorded*.
I add exactly two new terms — **risk inputs** and **straddle-implied move** — and no others.

### 1. Design system

`.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **`Status: SET`** (The Curvature Terminal). I
**adhere** and restate nothing from its token table. Specifically binding here: honesty copy carries
window/basis in-body (rule 4); warnings are `warning.*` **+ icon**, never brand amber (rule 5);
green/red are reserved for **direction** only; stat values are never heading elements; figures are
IBM Plex Mono / tabular; no new keyframes; no fourth convex-arc spend; zero hardcoded hex.

**Two amendment candidates I will raise as `product` conflicts at R2 — not silently add:**

- **A unit-bearing numeric input** (money / percent with an explicit unit control). Settings has no
  money input today; "global form-control radius beyond cards-10 + local overrides" is a declared
  *undeclared axis*, so needing one is an Amendments event, not a SPEC §4 invention.
- **A fifth member of the app's closed not-a-number vocabulary: `not set`.** `positions-legs`
  codified four (`—` not-applicable · `unavailable` failed-this-cycle · `not recorded` ·
  `no basis`, see `features/trading/positions/labels.ts`). `not set` is genuinely distinct — it is
  the only one **the trader can fix** — and adding a member to a canonical closed vocabulary should
  be recorded, not assumed.

---

### 2. Surface A — Settings → **Risk inputs** (item 2)

Placement: a new panel directly under **Preferences**, above **AI key**. It is a trader input, not a
credential; grouping it with keys would frame self-reported numbers as secrets.

Heading: **`Risk inputs`**. *(Not "Account" — that heading is taken by the auth panel. Not "Risk
profile" — that asserts a profile Convexa computes; it does not.)*

**Section helper (visible, not a tooltip):**
> Your own numbers, used only as context for AI recommendations. Convexa never checks them against a
> broker, never enforces them, and never uses them to score anything.

Three non-claims are load-bearing there and each must survive to ship: *not verified* · *not
enforced* · *not a scoring input* (`additive-keeps-score-byte-identical`).

**Fields**

| Control | Label | Visible helper under the input |
|---|---|---|
| money | `Account size` | `The account value you want sizing based on. You type it; Convexa never checks it against a broker.` |
| money **or** percent, unit explicit on the control | `Max risk per trade` | `The most you're willing to lose on one trade. The AI is told this figure and asked to size within it. Nothing in Convexa enforces it.` |

`Account size` is the label most likely to lie. It reads as a verified balance and it is a number the
user typed. The honesty rides a **visible helper**, matching the shipped `defaultTickerHelper` /
`themeHelper` pattern — not a hover, because a claim the reader must discover is a claim the product
is hiding.

**Open positions are not a field here.** They come from a book the app already holds. The section
discloses which one in one line: `Open positions included: your simulated positions in this browser.`
(That sentence is wrong if a lane routes the broker book instead — see Assumption 8.)

**States**

| State | What the user sees / can do | What must not happen |
|---|---|---|
| `anonymous` | Section renders; controls `aria-disabled` **and still focusable** and visibly quiet (the `positions-legs` refusal pattern — never the HTML `disabled` attribute, which swallows pointer events and makes the reason unreachable). Copy: `Sign in to save your risk inputs — they're stored with your account, never in this browser.` | No value written to localStorage. Anonymous is not offered a client-local variant: the surface these numbers feed is already auth-gated, so a browser-local copy would be dead data that a future export path could leak with no account attached to it. |
| `loading` | Existing Settings load treatment | Inputs never pre-populate with `0` |
| `empty` (signed-in, never set) | Blank inputs + placeholders + one consequence line: `Not set — AI recommendations will show "not set" where a risk figure would go.` | Not styled as an error or a warning. This is a blank form field, not a fault. |
| `default` (set) | Values + `Saved to your account.` | — |
| `saving` | `Saving…`, controls quiet | — |
| `saved` | Existing `Saved` confirmation | — |
| `error` | `AUTH_COPY.settings.saveError` verbatim (`Couldn't save that setting. Please try again.`); typed values stay in the fields | Never shows `Saved`; never clears the input; never claims a partial save |
| `invalid` | Refused before any network write. `Enter a number greater than zero.` / `Enter a percentage between 0 and 100.` | No server round trip for a value we can reject locally |
| `storage_unavailable` | Mirrors the shipped `aiKey.storageUnavailable` shape: `Risk inputs can't be saved on this deployment right now. Nothing was stored.` | No value claimed as saved |

**No `stale` / `offline` state.** This surface is STATIC — declared explicitly per
`[live-vs-static-isolation]`.

---

### 3. Surface B — Ticker → **Straddle-implied move** (item 3)

**This is the copy call I will not trade away.** The datum is the ATM straddle price. Labeling it
`Expected move` asserts a probabilistic expectation ("±$X by expiry, ~68% of the time") that the
number does not carry and that nothing in this feature calibrates. That is precisely a label renaming
what the value actually is.

- **Title:** `Straddle-implied move`
- **Headline:** `± $X.XX  (± Y.Z%)` — mono, tabular, never a heading element
- **Basis line (VISIBLE, never tooltip-only):** `From the {EXPIRATION} ATM straddle · {N} DTE · mid quotes`
- **Advisory line (visible, muted — matching the shipped static family):**
  `What options are priced for — not a forecast, not a probability, not a scored signal.`
- **Tooltip / glossary:**
  > The at-the-money call plus put, priced together. Traders call this the "expected move" — it is
  > what the options market charges for the move, not a prediction and not a confidence interval.
  > Convexa shows it because it makes a target or a stop defensible, not because it is likely to be
  > right.

The industry term appears **only** inside that tooltip, where it is defined and disarmed.

**Placement:** a fifth sub-card inside the existing `market-context` widget if the backend nests it
there, otherwise a compact widget immediately after `iv-rank`. Binding regardless: STATIC family,
headline visible without expanding, basis visible without hovering. **No twelfth bento widget for one
scalar** — the ticker board is at eleven and hierarchy is already the page's scarcest resource.

**States**

| State | Render | Rule |
|---|---|---|
| `loading` (cold) | Shipped per-source skeleton | Visually distinct from both unavailable literals (the shipped skeleton-first contract) |
| `default` | headline + basis + advisory | — |
| `unavailable — no quote` | `No ATM straddle quote this cycle.` | The ATM leg had no NBBO |
| `unavailable — not computed` | `Straddle-implied move unavailable this cycle.` | Compute faulted / no ATM strike resolvable |
| `stale` | Inherits the bundle freshness line | No second stale marker |
| `offline` (SSE drop) | **Un-dimmed, no offline chip, keeps rendering the last bundle** | STATIC family, like the four positioning tiles |

The two `unavailable` causes are **distinct literals rendered from a wire reason token via closed
lookup** — the FE never infers which one it is by inspecting a null (`[absent-is-not-none]` +
`[digested-labels-not-raw-dump]`: the wire token is authoritative).

There is **no `building` state**. The straddle needs only the chain in hand. If a lane proposes
accumulation here, that is a scope change, not a state I own.

**Ruled out for v1 with cause:** no expected-move band, shaded region, or reference line on the GEX
profile chart. The GEX chart is a positioning chart on a strike axis; a shaded ± region there reads
as a confidence interval the number cannot support, and it would be the fourth thing competing with
spot / flip / live-flip reference labels that were already de-collided once.

---

### 4. Surface C — the AI rec panel: where the gap actually closes (items 1+2+3 converge)

#### 4a. The four risk fields get a closed literal set

`max_risk` · `position_size` · `exit_plan.target` · `exit_plan.stop` today all collapse to `—`. Four
causes, one em-dash. Replacement closed set:

| Literal | Means | Fires when | Tip |
|---|---|---|---|
| *the value* | — | — | — |
| `—` | not applicable | verdict is `no_trade` | `No entry, so there is nothing to size.` |
| `not set` | you haven't given Convexa this input | risk block empty (`max_risk` / `position_size` only) | `Convexa didn't send a risk figure, so the AI had nothing to size against.` + action `Set your risk inputs` → Settings |
| `unavailable` | an input the AI needed was missing this cycle | candidate quotes / straddle absent when the rec ran | `The AI didn't get the numbers this needs. Your other reads are unaffected.` |
| `not given` | the AI returned a trade and left this blank | field null, all inputs present | `The AI produced a trade read but didn't fill this in. Nothing failed — it declined to answer.` |

`null`, `undefined`, `NaN`, `0` and an empty cell never render — a blank cell in a screenshot is
indistinguishable from an interpolation bug.

**The `unavailable` / `not given` split needs a per-field reason from upstream.** If no lane carries
it, the two collapse into one literal whose tip must read *"either the AI left this blank or an input
it needed was missing"* — honest but strictly weaker. I state the fallback so the degradation is a
recorded decision, not a silent one. Preferred version is the split.

#### 4b. Provenance — without Convexa doing arithmetic

Beside the risk row, when the block is set:

`Sized against your inputs · Account $50,000 · Max 1%/trade`

Tip:
> The AI was given these figures. This number is the AI's, not Convexa's arithmetic — check it
> against your own before you act.

**The FE performs no multiplication on the entered values.** It renders exactly what the trader typed.
The moment the UI computes `1% × $50,000 = $500` and prints it beside an AI string, the reader
reasonably concludes Convexa validated the AI's number. It did not, and the failure mode of that
misreading is a mis-sized real trade.

#### 4c. New state: **superseded inputs**

The rec is a static artifact pinned to its snapshot, so editing the risk block does **not** re-stale
it through the existing mechanism — but the sizing on screen is now based on numbers the trader
changed. Strip, using the shipped **stale-strip treatment** (not `warning.*`+icon — this is a truth
marker, not a warning; reserving warning styling is what keeps the warning pattern meaningful):

> Your risk inputs changed after this read. The sizing below is based on the earlier values.

Action reuses the existing string `Get a fresh recommendation`.

#### 4d. The cited contract (item 1's only trader-facing spend)

When the rec names strikes + expiration, one compact fact line sourced from the candidate set:

`{STRIKE} {C/P} {EXPIRY} · bid {b} / ask {a} · Δ {d} · IV {iv}% · from the {as_of} chain snapshot`

When the AI cites a contract **not** in the candidate set (outside the ±15% band, or a different
expiry — a real and likely case):

> `Not in the candidate set Convexa sent`

No fabricated quote, no silent omission. This single line is the highest-value fabrication guard in
the feature: it is the difference between "the rec is grounded in prices we sent" and "the rec named
a contract and we drew a price beside it."

#### 4e. Binding framing, expressed as interface rules

The brief's carried framing — *better inputs should make `no_trade` **better-argued**, not convert it
to trades* — is not a model concern alone. A UI that makes a filled `max_risk` look like the success
state produces exactly that drift through hierarchy rather than through the model. So:

- The `no_trade` card renders the **same** `Why` and `Levels in play` sections a trade verdict
  renders — never a stripped-down card.
- It gains a **`What the numbers said`** fact strip carrying the straddle-implied move and, when a
  candidate was cited, that contract's spread — the same data, no new claim.
- Existing `noTrade` copy stays verbatim: `No trade — sit this one out` /
  `No entry to Accept — a 'no trade' read is a complete, correct answer.`
- **No verdict state gets a success or error palette slot on the hero.** No count, no "N setups
  found", no badge, no empty-state illustration. `no_trade` is a **result**, never an empty state.

---

### 5. Surface D — the export drawer: a shipped sentence that becomes false (BLOCKING)

`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts:68` (FE fallback for the server-supplied
`egress_note` rendered at `StateExportDrawer.tsx:127`) currently promises:

> "This is the complete, reviewable list of what leaves the machine for {TICKER}, on demand: the
> computed snapshot, your persona's prompt, and the field glossary. **No other ticker, no account or
> identity, no broker/order data, and no API key ever leave.**"

Item 2 sends **account size**, a **per-trade risk cap**, and **open-positions context**. That makes
`no account or identity` false today, and makes `no broker/order data` false the moment the
open-positions context reads the broker book. **This string cannot ship unchanged.** Amending it is
not polish; it is the difference between an honest product and a false claim in the exact place the
product promises honesty.

Proposed replacement (adjust the enumeration to what actually ships):

> This is the complete, reviewable list of what leaves the machine for {TICKER}, on demand: the
> computed snapshot, the candidate contracts, your risk inputs, your open simulated positions, your
> persona's prompt, and the field glossary. No other ticker, no name, email or login, no broker
> credentials, and no API key ever leave. Nothing is ever placed as an order.

The drawer gains two sections in the shipped section pattern: **`Candidate contracts`** (with a count
— `N contracts across M expirations`) and **`Your risk inputs`** (the exact values sent). A category
**not** sent renders an explicit `Not sent — you haven't set this.` line rather than an absent section
(`[absent-is-not-none]`: a missing section reads as "we sent nothing" *and* as "this feature isn't
here", and the trader cannot tell which).

`View what's sent` must stay reachable in **every** rec-panel state — including `not set` and
`no_trade` — so a trader can confirm that an empty risk block means nothing was sent.

---

### 6. Surface E — candidate quotes: **no chain table in v1**

`[digested-labels-not-raw-dump]` is named in the brief as in DIRECT TENSION with item 1, and the
brief instructs the council to hold the line. I hold it on the UI side too: **v1 ships no
trader-facing option-chain table, grid, or browser.** A ±15% band across expirations rendered on the
bento *is* the raw dump the rule forbids, it duplicates a surface every broker does better, and it
answers a question the trader did not ask here ("browse the chain") instead of the one they did ("can
I act on this rec").

The candidate set therefore surfaces in exactly two places: **the cited-contract fact line (§4d)** and
**the export drawer (§5)**. A chain browser, if ever wanted, is its own feature with its own brief.

---

### 7. What I will not build, stated so no one has to infer it

- **No sizing calculator.** No "you can afford N contracts," no contract-count stepper driven off the
  risk block. A calculator is one button from an order ticket, and `[no-real-order-path]` binds.
- **No enforcement.** Convexa never blocks, warns on, or refuses an entry that exceeds the cap. The
  cap is a number we forward, and the copy says so.
- **No risk-block field on the anonymous path.**
- **No new motion, no arc spend, no green/red on any value added here.**

---

### 8. Acceptance criteria — with `Verify by` and the state each satisfies

| ID | Criterion | State(s) | Verify by |
|---|---|---|---|
| U-1 | Signed-in Settings renders a `Risk inputs` panel with `Account size` and `Max risk per trade`, each carrying its visible helper naming *not verified* / *not enforced*, plus the section line naming *never used to score anything*. | Settings `default`/`empty` | review |
| U-2 | Anonymous renders the panel with `aria-disabled` **and focusable** controls (never the HTML `disabled` attribute) and the sign-in line; no risk value is written to any durable client store in this state. | Settings `anonymous` | test |
| U-3 | `Max risk per trade` carries an explicit unit on the control, and every later display of that value carries its unit; a bare number with an inferred unit never renders anywhere. | Settings `default`; rec `default` | test |
| U-4 | A failed save keeps the typed values in the fields, shows `settings.saveError` verbatim, and never shows `Saved`. | Settings `error` | test |
| U-5 | Non-numeric, ≤ 0, or percent > 100 is refused locally before any network write, with the named per-field message. | Settings `invalid` | test |
| U-6 | When storage is unavailable server-side, the panel shows `Risk inputs can't be saved on this deployment right now. Nothing was stored.` and claims no value as saved. | Settings `storage_unavailable` | review |
| U-7 | A never-set risk block shows the consequence line naming what AI recs will display, styled as a blank field — not as an error or a warning. | Settings `empty` | review |
| U-8 | The chain-derived move read is titled `Straddle-implied move`; the string `Expected move` appears **only** inside its explanatory tooltip, never as a label, heading, or chip. | EM `default` | review |
| U-9 | The value renders with expiration + DTE + quote basis **visible without hovering or expanding**, plus the line `not a forecast, not a probability, not a scored signal.` | EM `default` | review |
| U-10 | The two null causes render two distinct literals selected by closed lookup on a wire reason token; the FE never picks the literal by inspecting the null value. | EM `unavailable — no quote` / `unavailable — not computed` | test |
| U-11 | On an SSE drop the read is not dimmed, gains no offline marker, and keeps rendering the last bundle. | EM `offline` | test |
| U-12 | Cold load shows the skeleton, visually distinct from both unavailable literals. | EM `loading` | test |
| U-13 | No expected-move band, shaded region, or reference line is added to the GEX profile chart. | n/a (negative space) | test |
| U-14 | Each of `max_risk`, `position_size`, `exit_plan.target`, `exit_plan.stop` renders exactly one member of the closed set {value, `—`, `not set`, `unavailable`, `not given`}; `null`, `undefined`, `NaN`, `0` and an empty cell never render. | rec — all | test |
| U-15 | A `no_trade` verdict renders `—` on all four with the not-applicable tip — never `not set`, never `unavailable`. | rec `no_trade` | test |
| U-16 | With a trade verdict and an empty risk block, `max_risk` and `position_size` render `not set` with a `Set your risk inputs` action that navigates to the Settings panel. | rec `not set` | test |
| U-17 | With the risk block set, the provenance chip renders the entered values **verbatim** and the client performs no arithmetic on them. | rec `default` | test |
| U-18 | The `max_risk` tip states the figure is the AI's and not Convexa's arithmetic. | rec `default` | review |
| U-19 | Editing the risk block after a rec was produced shows the superseded-inputs strip using the stale-strip treatment (not `warning.*`+icon) with the existing `Get a fresh recommendation` action. | rec `superseded` | test |
| U-20 | A cited contract present in the candidate set renders its quote/greeks with the snapshot as-of; a cited contract absent from it renders `Not in the candidate set Convexa sent` and no quote figure. | rec `cited` / `cited-off-set` | test |
| U-21 | The `no_trade` card renders the same `Why` and `Levels in play` sections a trade verdict renders, plus the `What the numbers said` fact strip. | rec `no_trade` | test |
| U-22 | No verdict state applies a success or error palette slot to the verdict hero, and no copy or counter frames `no_trade` as an empty or zero-result state. | rec — all | test |
| U-23 | The egress note enumerates every category actually sent and no longer claims `no account or identity`; the server `egress_note` and the FE `COPY.export.egress` fallback assert the same thing. | export `default` | test |
| U-24 | The export drawer renders a `Candidate contracts` section with a count and a `Your risk inputs` section with the values sent. | export `default` | review |
| U-25 | A category that was not sent renders an explicit `Not sent` line rather than an omitted section. | export `partial` | test |
| U-26 | `View what's sent` is reachable in every rec-panel state, including `not set` and `no_trade`. | rec — all | test |
| U-27 | No value added by this feature renders in a success/error color; all figures use the mono/tabular treatment; zero hardcoded hex. | all | test |

`review` is used only for wording, presence and intentional ordering — things a human notices on a
normal pass. Everything that would break **silently** under an unrelated refactor (a literal
collapsing to `—`, a static read starting to dim, a chart band creeping in, two copies of one egress
claim drifting apart, an arithmetic helper appearing in the provenance chip) is `test`.

---

## Risks I see

1. **The egress sentence ships stale.** It lives in a file nobody in this feature has a reason to
   open, and the server copy is a second instance of the same claim. If it ships unamended, the app
   makes a false statement in the one surface whose entire purpose is being true. Highest-severity
   item in my lane; U-23 exists for it and is deliberately `test`, not `review`.
2. **`unavailable` and `not given` collapse.** If nothing upstream carries a per-field reason, the
   feature's flagship honesty gain — four causes, four literals — degrades back toward one em-dash
   with a hedging tooltip. Recorded fallback in §4a so this is a decision, not an accident.
3. **"Expected move" wins on familiarity.** It is the term traders search for and the term a
   stakeholder will ask for. If it takes the label slot, the number silently acquires a probability
   claim nothing calibrates. U-8 pins it; I expect to defend it at R2.
4. **`not set` becomes a nag.** It is the feature's conversion moment and its biggest tone risk. If
   it renders as a warning banner it reads as "Convexa is broken" instead of "you have one field to
   fill in." Quiet, inline, one action, no icon, no amber.
5. **The chain table arrives later as a "UX request."** "We already have the data, just show it" is
   how `[digested-labels-not-raw-dump]` gets breached, and it arrives through my lane. §6 is my
   pre-refusal.
6. **Numbers make trades feel more legitimate than `no_trade`.** Once `max_risk` prints a real dollar
   figure, a trade verdict looks like the app's success state through pure visual weight. That
   reproduces exactly the failure the brief's binding framing warns about — via hierarchy, not via
   the model. U-21/U-22 are the guards, and they are the ACs most likely to be judged "cosmetic" and
   dropped.
7. **Sizing context slides toward an order path.** A reference chip becomes a calculator becomes a
   contract stepper becomes a ticket. `[no-real-order-path]` binds, and §7 states the stopping point
   before anyone has to relitigate it.
8. **An anonymous browser-local risk block.** Consistent with existing prefs, and wrong here:
   self-reported financial figures in localStorage with no account attached, feeding a surface that
   is auth-gated anyway. I refuse the anonymous write; if a lane wants it, it needs its own argument.
9. **Settings becomes a scroll.** Risk inputs makes five panels. Ordering (under Preferences, above
   AI key) is my mitigation and is deliberate, not incidental.
10. **393px overflow.** `Sized against your inputs · Account $50,000 · Max 1%/trade` plus four literal
    cells in the rec panel is new width in a page already pinned by the no-overflow e2e suite.

---

## Assumptions I'm making about the other two lanes

- **The rec response can indicate, per field, whether the model left `max_risk` / `position_size` /
  `exit_plan.target` / `exit_plan.stop` blank versus whether an input needed to fill it was missing.**
  Without that, the UI cannot distinguish `not given` from `unavailable` and §4a's split collapses.
- **The risk block is stored on the existing per-user settings record and arrives in the same call as
  the rest of Settings** — no second fetch, no extra loading state on the Settings page.
- **The risk-block write is server-gated with a real 401/403** (`server-side-gate-enforcement`), so my
  anonymous `aria-disabled` treatment is UX only and a bypassed client is still refused server-side.
- **The candidate-contracts endpoint is called server-side while producing a rec (and/or reflected in
  the export payload)** — the browser never fetches or renders a ±15% chain itself, and the export
  drawer can enumerate what was sent without a second round trip.
- **The rec identifies its recommended contract in a machine-comparable form (strike + expiration +
  right), not only in prose**, so the FE can match it against the candidate set rather than
  string-matching the analyst text. U-20's off-set literal is unimplementable otherwise.
- **The straddle-derived move arrives on the bundle as a STATIC, nullable, additive field carrying a
  closed reason token when null** — at minimum distinguishing "no ATM straddle quote" from "not
  computed" — and is **not** on the SSE payload and **not** accumulated over sessions.
- **That field carries its expiration, DTE and quote basis in the payload**, so the FE renders the
  basis rather than deriving it from the active DTE filter (which would drift from the basis actually
  used).
- **The per-trade cap is stored with its unit** ($ or %) alongside the number, so the UI never infers
  a unit. U-3 is unimplementable if the record is a bare scalar.
- **`open_positions` context sent to the AI is the client-local SIMULATED book, not the broker book.**
  My egress copy (§5) names simulated positions and is factually wrong if a lane routes
  `GET /api/broker/book` instead — that would also newly falsify `no broker/order data`.
- **Nothing in this feature reaches `signals` / `opportunity_score` / `opportunity_tier` /
  `state_fingerprint`**, so no tile, tier band, gate copy, or scanner column anywhere else in the app
  changes wording as a side effect.
- **No order, broker, or execution surface is introduced by item 2**, so no lane expects a "place this
  trade" affordance and the provenance chip stays a readout.
- **`egress_note` is produced server-side with `COPY.export.egress` as the FE fallback** (as
  `StateExportDrawer.tsx:127` implies), so the amended wording must land in **both** places and one
  lane owns keeping them identical — U-23 asserts the pair, not just one.
