# R1 — ux position: ai-rec-grounding

## Position

Read first: `project.json`, `BRIEF.md`, `_context-pack.md`, `DESIGN_SYSTEM.md` (**Status: SET** — The
Curvature Terminal; I adhere, I do not restate its token table), and the live surface
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/` (`AiRecPanel.tsx`, `CapAnnotation.tsx`,
`CitedContractLine.tsx`, `ProvenanceChip.tsx`, `NumbersSaidStrip.tsx`, `literals.ts`, `copy.ts`,
`reasoning.tsx`).

---

### 1. User, job, vocabulary

- **Intended user.** The shipped rec card's user, unchanged: an operator / swing trader in a dark
  terminal, reading under time pressure, who already distrusts UIs that overclaim. No new persona,
  no onboarding, no settings surface.
- **Primary job.** Decide in one pass whether to act on this read — and know **which of its numbers
  Convexa can vouch for and which are the model's alone**, before sizing against one.
- **Information structure (unchanged order, one insertion).** verdict hero → **[NEW: one grounding
  line]** → risk tile (risk first, binding) → plan → cited contract → exit → sizing → context →
  reasoning. The grounding line is a *qualifier on everything below it*, so it sits directly above
  the risk tile and nowhere else. It is one line. It is never a section.
- **User vocabulary (binding on every string I propose).** Say: *Convexa's number*, *the AI's own
  number*, *couldn't check*, *put wall*, *the chain*. **Never say, in any user-facing string:**
  `verified` · `confirmed` · `validated` · `approved` · `safe` · `trusted` · `hallucinated` ·
  `suspect` · `invalid` · `failed` · `provenance` · `traceability` · **`grounding`**. The feature is
  called `ai-rec-grounding`; that word never reaches a user. Component names may use it; copy may not.

**The one sentence this feature must not let the UI say.** "Verified" in a trading card is read as
*Convexa vetted this trade*. We vetted nothing of the kind. What we did is far narrower and must be
said narrowly: **this figure lines up with a number Convexa computed from the option chain.** That is
an arithmetic-and-source claim, not a judgement about the idea.

---

### 2. Where each asserted figure's grounding is stated — one claim, one place

The card already has three honesty surfaces. Adding a fourth per figure would double-state some
claims and clutter a card that is already long. Mapping:

| Asserted figure | Where its grounding is stated | New or existing |
| --- | --- | --- |
| `strikes` + `expiration` + right | `CitedContractLine` (shipped closed `cited_contract` lookup) | **existing — add nothing** |
| `max_risk` | `CapAnnotation` (shipped closed `cap_check` lookup) | **existing — improve the reason clause only (§7c)** |
| `exit_plan.stop` | new per-field clause under the Stop value | **new** |
| `exit_plan.target` | new per-field clause under the Target value | **new** |
| `position_size` | new per-field clause under the Suggested size value | **new** |
| `invalidation_level` | new per-field clause under the Invalidation value | **new** (and it needs the closed literal set first — §7a) |
| levels named in `rationale` / `key_points` prose | **never annotated inline.** A separate compact row beside `Levels in play` | **new, and conditional** (§3c) |
| the whole card | one card-level line above the risk tile | **new** |

**Inline prose annotation is refused outright**, on two grounds: (1) markers inside an analyst
paragraph destroy the read the section exists to deliver; (2) any inline marker requires the browser
to match substrings back to wire tokens, which is exactly the client-side re-derivation
`digested-labels-not-raw-dump` forbids. If prose levels are in scope, they arrive as a
server-extracted list or they are excluded — and if excluded, the card-level tooltip **says so**
(§3a). Withdrawing that claim is cheaper than faking it.

---

### 3. The closed vocabulary

Every string below is rendered through a **closed lookup on a wire token** in `literals.ts` — never
by testing a null, never by comparing two figures in the browser. The wire token's *name* is not
user-facing copy; these literals are.

#### 3a. Card-level line — exactly one member always renders on a produced rec

| Member | Literal (verbatim) | Chrome |
| --- | --- | --- |
| all traced | `Every checked figure traces to a Convexa number.` | caption · `text.secondary` · no icon |
| some untraced | `Some figures here are the AI's own — each one says so below.` | caption · `text.secondary` · no icon |
| none traced | `No figure here traces to a Convexa number.` | `warning.main` + `WarningAmberIcon` |
| couldn't check | `Convexa couldn't check these figures this cycle.` | `warning.main` + `WarningAmberIcon` |
| wasn't checked | `This read wasn't checked against Convexa's numbers.` | `warning.main` + `WarningAmberIcon` |
| nothing to check | `No entry figures on a no-trade read.` | caption · `text.disabled` |

`couldn't check` (the check ran and could not conclude) and `wasn't checked` (no verification reached
the browser at all — older backend, local fallback, stub provider) are **distinct literals and never
synonyms**. This pair is the `absent-is-not-none` carrier at the client boundary, and it is the whole
reason silence is not an acceptable render: once this line always appears, its *absence* would itself
read as "traced".

**The definition tooltip** (on the card-level line only — the term is defined once, not per field):

> `Traced` means the figure lines up with a number Convexa computed from the option chain. It is not
> a judgement that the trade is good — Convexa checks where a number came from, never whether the
> idea is right. Convexa checks the stop, target, suggested size, invalidation level and the contract
> named. The analyst read's prose is not checked figure by figure.

That last sentence is the claim withdrawal. It must survive editing.

#### 3b. Per-field clause — closed set of three, on value-bearing fields only

| Member | Literal (verbatim) | Tooltip |
| --- | --- | --- |
| traced | `traces to Convexa's {source} ({value})` — e.g. `traces to Convexa's put wall (412)` | *(none — the source and its value are already visible)* |
| untraced | `the AI's own number` | `Convexa compared this against the levels and quotes it computed and didn't find it. That doesn't make it wrong — it means Convexa can't vouch for it.` |
| couldn't check | `couldn't check this` | `{server-supplied missing-input clause}. The figure above is the AI's, unchanged.` |

`traces to` — not `matches`, not `equals`. If the server matched inside a tolerance, `matches` would
be false; `traces to` is true either way, and rendering **the source's own value in parentheses** lets
the trader see the gap himself rather than trusting my verb. That parenthesized value is
non-negotiable: a bare `traces to Convexa's put wall` is a badge, and a badge is the failure mode.

`the AI's own number` is deliberately not `unverified`. It is a statement of authorship, not an
accusation, and it generalizes a sentence already shipped in `copy.ts`
(`MAX_RISK_TIP = "This is the AI's figure — Convexa did not compute it."`).

#### 3c. The named-levels row (conditional)

If prose levels are in scope, they render as a compact row directly under the shipped `Levels in
play` strip, labelled **`Levels this read names`**, one chip per level: the level value + its
per-field clause from 3b. Same chip idiom as `Levels in play`, so the reader sees Convexa's levels
and the model's levels in the same visual grammar and can compare them without reading prose. If the
server cannot supply that list, this row does not ship and the tooltip's "prose is not checked"
sentence stands.

#### 3d. The non-collapse rule (structural, testable)

> A grounding clause renders **only** on the `value` member of `fieldLiteral`. A field showing `—`,
> `not set`, `unavailable`, `not given`, or `size not suggested` carries **no** grounding clause,
> ever.

This is not a style preference. `unavailable` says *the value is missing*; `couldn't check this` says
*the value is here and the check failed*. They can never co-occur (no value ⇒ nothing to check), and
letting both render on one field would collapse two distinct truths into visual noise. It also keeps
`no_trade` clean by construction: `fieldLiteral` short-circuits `no_trade` to `dash` **first**, so
the four fields carry no clause without a second branch deciding it.

---

### 4. Component-state matrix

| State | What renders | What must not happen |
| --- | --- | --- |
| **idle** (no rec) | nothing new | no placeholder/skeleton implying a pending verdict |
| **loading** (`Thinking…`) | nothing new | no grounding skeleton — a pending check must never occupy the space a verdict will |
| **produced · trade** | card-level line above the risk tile + a per-field clause on every value-bearing figure | no figure renders as fact with no clause and no covering surface |
| **produced · no_trade** | card-level `No entry figures on a no-trade read.`; four fields keep `—`; **no** `CapAnnotation` (shipped AC-58a) | a `—` never gains "couldn't verify" beside it — verifying an absent premise is nonsense |
| **stale** (newer bundle arrived) | grounding clauses render **byte-identical**; the shipped stale strip is the only thing that says the read is old | a verdict must never silently re-resolve against a newer put wall |
| **stale-born** | unchanged shipped warning strip + normal grounding | grounding does not restate staleness |
| **offline** (SSE drop) | grounding is **static** — never dimmed, never `⏸ offline`, never re-checked | `[live-vs-static-isolation]`: it sits next to live-ish numbers and must not inherit their degrade |
| **verification block absent** | card-level `This read wasn't checked against Convexa's numbers.` | silence — absence must not read as traced |
| **empty / unavailable / byo-CTA / cooldown / cap / signed-out** | no grounding surface (no rec body exists) | the grounding line never appears without figures to qualify |
| **scripted scenario (hallucinating provider)** | shipped scripted chip + strip, plus card-level `No figure here traces to a Convexa number.` and per-field `the AI's own number` | this is the feature's proof state; it must be reachable from a fixture without an LLM |

---

### 5. Visual weight — the judgement call

The tension: loud enough to be honest, quiet enough not to drown a card the trader reads in seconds.
My resolution is **asymmetry plus a single loud point**.

1. **One loud line, everything else quiet.** The card-level line is the only element that may carry
   `warning.main` + icon, and only in its three unhappy members. The per-field clauses are always
   `variant="caption"` / `text.secondary`, no icon, no chip, no border — the same weight as the
   shipped `CitedContractLine` and the `NumbersSaidStrip` freshness line. A trader who reads nothing
   but the top of the card still learns the one fact that changes his behaviour.
2. **Per-field `untraced` gets no warning icon.** Deliberate. Untraced stops and targets will be
   *common*; four warning icons on every rec becomes wallpaper inside a week and the icon stops
   meaning anything — which makes the honest marker *less* honest, not more. Warning chrome is
   reserved for the machinery failing (`couldn't check` / `wasn't checked`) and for the total-miss
   case, exactly as `CapAnnotation` spends it today.
3. **No green, no check glyph, no success slot — including on the traced state.** Canon reserves
   green/red for signed direction, and `CapAnnotation` already establishes the house rule that even
   `within` renders through warning chrome because Convexa never frames "the AI stayed inside your
   number" as a win. Traced is the same class of non-win.
4. **Secondary scan cue: type register.** Convexa-computed figures already render in the IBM Plex
   Mono data register (`LevelsStrip`); model-asserted figures render in the body register (the rec
   `Field` values). That split exists in shipped code by accident. I propose making it **deliberate
   and binding**, so the parenthesized source value in `traces to Convexa's put wall (412)` renders
   mono while the model's `412` above it does not — the register itself says whose number it is.
   This is a **DESIGN_SYSTEM Amendment candidate**, not something I declare (§6). It is a
   reinforcement only: the words carry the meaning; register carries the scan.

**Accessibility (binding).**
- Every grounding state is **fully stated in visible text**. No state is carried only by a tooltip,
  an icon, or a colour — tooltips are unreachable on touch and this is a mobile-capable surface.
- The warning icon is `aria-hidden`; the clause text is in the field's DOM order so it is announced
  with its label. Tooltips use the shipped `describeChild` idiom.
- Caption text ≥ 11px (canon type floor). `warning.main` caption text must clear 4.5:1 in **both**
  modes — this is the grade-of-amber trap the canon calls out; if it fails in light, the fix is
  `extrasFor(theme).textAmber`, never a hardcoded value.
- At 393px, four fields each gaining a ~30-character clause must not produce horizontal overflow;
  the clause wraps on its own line under the value.

---

### 6. Design-canon adherence and Amendment candidates

**Adhered, no new system.** No new colour, no new token, no new motion family, no fourth arc spend,
no new component family — one new small component (`GroundingNote`) built exactly on the shipped
`CapAnnotation` shape, plus additions to `copy.ts` / `literals.ts`. `warning.*` + icon per canon
rule 5. `extrasFor(theme)` for anything mode-aware; zero hex.

**Amendment candidates — I raise these as R2 `product` conflicts; I do not append them myself:**
1. **Closed not-a-number vocabulary grows** by the six card-level members and the three per-field
   members. The Amendments table already logs this class of growth (2026-08-12, `not set` /
   `size not suggested`), so this is the same event, not a second system.
2. **Type register as provenance** (§5.4) — mono = Convexa computed, sans = model asserted. This
   *is* a new binding rule and belongs in Amendments if accepted. Optional; the feature ships
   without it.

---

### 7. Defects I found on the shipped surface (in my lane, in scope)

**a. `absent-is-not-none` already has a hole on `main`.** In `AiRecPanel.tsx`,
`const fmtNum = (n) => (n == null ? '—' : String(n))` renders `Invalidation` — and `Structure`,
`Strike(s)`, `Expiration`, `Entry trigger` use a bare `?? '—'`. Five fields therefore print `—`
*outside* the closed literal set, where `—` is defined as **"No entry, so there is nothing to size."**
A model that simply omitted the invalidation level renders identically to a `no_trade` card's
not-applicable dash. That is the exact collapse this feature exists to prevent, and it is shipped.
These five fields should move onto `fieldLiteral` before any grounding clause is attached to them —
otherwise I would be marking the grounding of a value whose absence is already mis-stated.

**b. `MAX_RISK_TIP` is about to become load-bearing.** It says "This is the AI's figure — Convexa did
not compute it." Once `cap_check` starts resolving (the prompt fix), that tip and the cap verdict sit
one line apart saying related-but-different things. They must be read together and not drift; the tip
is the per-field authorship claim, the cap line is the comparison claim.

**c. `CAP_COULD_NOT_CHECK` has no reason and no tooltip.** "Couldn't check against your cap." leaves
the trader with nowhere to go — and the V10 harness measured it on **4 of 4** after-arm trades, so
today it is nearly the only cap state anyone sees. The wire already carries
`cap_check.cap_not_derivable_reason`. Add a reason clause rendered by **closed lookup on that
existing token** (never composed client-side). Once the prompt fix lands, `within` becomes common for
the first time — and I re-affirm the shipped rule that `within` and `above` share the same warning
chrome. `within` must not quietly become a green tick the day it starts appearing.

**d. Honesty-surface density.** After this feature the card carries: scripted strip, stale-born strip,
stale strip, superseded strip, provenance chips, `Levels in play`, `What the numbers said`, freshness
line, cap annotation, cited-contract line, four field literals — and now a grounding line plus per-field
clauses. Every one is individually justified; together they are a wall. The grounding line must reuse
the existing caption idiom exactly and add **no** new chrome, or the card tips from honest to unreadable.
I flag this as the highest-risk cost of shipping this feature well.

---

### 8. Acceptance criteria — state mapping and `Verify by`

`test` where a silent regression under an unrelated change would pass a normal human review;
`review` where the thing is visible and intentional.

| # | Criterion | State(s) | Verify by |
| --- | --- | --- | --- |
| UX-1 | On a produced rec exactly **one** card-level line renders, and it is one member of the closed six | produced · no_trade · absent-block | test |
| UX-2 | The card-level member is chosen by closed lookup on a **server** token; the browser never counts, compares or folds per-field tokens into a card verdict | all | test (mutation: poison a figure, verdict unchanged) |
| UX-3 | A grounding clause renders **only** on the `value` member of `fieldLiteral`; `—`/`not set`/`unavailable`/`not given` carry none | produced · no_trade | test |
| UX-4 | On `no_trade` no field carries a grounding clause and no cap surface mounts (shipped AC-58a holds) | no_trade | test |
| UX-5 | `couldn't check` and `wasn't checked` are distinct strings and never render together | couldn't-check · absent-block | test |
| UX-6 | When no verification block reaches the browser, the card renders `wasn't checked` — never silence, never the traced member | absent-block | test |
| UX-7 | No user-facing string in the ai-rec module contains `verified` / `confirmed` / `validated` / `approved` / `safe` / `trusted` / `grounding` / `hallucinated` / `suspect`, nor a check glyph | all | test (source scan, mutation-tested) |
| UX-8 | The traced clause names the source **and** the source's own value; a bare source name with no value is a defect | produced (traced) | test |
| UX-9 | Verbatim copy of the six card-level members and three per-field members matches §3 | produced | review |
| UX-10 | The definition tooltip states that traced ≠ good trade **and** names what is not checked | produced | review |
| UX-11 | Every grounding state is fully stated in visible text; none is carried only by tooltip, icon or colour | all | test (a11y) |
| UX-12 | The grounding surface uses no success/error palette slot and no green/red; only the three unhappy members use `warning.*` + icon; the icon is `aria-hidden` | all | test |
| UX-13 | Zero hardcoded hex; mode-aware values only through `extrasFor(theme)`; dark/light parity | all | test (existing hex-discipline suite) |
| UX-14 | Grounding verdicts are pinned to the rec's snapshot: an SSE tick or a newer bundle never changes, re-derives or dims a clause | stale · offline | test |
| UX-15 | No grounding surface renders during `loading`, `unavailable`, byo-CTA, cooldown, cap or signed-out | all degraded | test |
| UX-16 | A scripted hallucinating rec renders card-level `none traced` and per-field `the AI's own number` on every asserted figure | scenario | test |
| UX-17 | Prose carries no inline grounding markup; if `Levels this read names` ships, its entries come from a server-supplied list, never browser substring matching | produced | test |
| UX-18 | The card-level line sits below the verdict hero and above the risk tile; risk stays first among detail fields | produced | review |
| UX-19 | `Invalidation`, `Structure`, `Strike(s)`, `Expiration`, `Entry trigger` render through the closed literal set — no bare `'—'` fallback (§7a) | produced | test |
| UX-20 | `CAP_COULD_NOT_CHECK` carries a reason clause rendered by closed lookup on `cap_not_derivable_reason`; never composed client-side | produced (cap) | test |
| UX-21 | `within` and `above` continue to share the same warning chrome; `within` never renders as success/green | produced (cap) | test |
| UX-22 | At 393px, with the longest clause on all value-bearing fields, no horizontal overflow | produced · mobile | test (e2e no-overflow suite) |
| UX-23 | Grounding caption text ≥ 11px and `warning.main` caption clears 4.5:1 in both modes | all | test |
| UX-24 | The export drawer makes no grounding claim — it describes egress, not the response | export drawer | review |

---

## Risks I see

1. **The card tips from honest to unreadable.** This is the dominant risk (§7d). Twelve honesty
   surfaces plus a thirteenth. Mitigation is total chrome restraint: one new component, zero new
   visual vocabulary, one loud line.
2. **"Traced" gets read as "vetted" anyway.** Even with the tooltip, some traders will read the
   affirmative line as endorsement. Partially unavoidable; mitigated by never using an approval word
   or glyph and by naming the source value so the claim visibly stays arithmetic. If R2 shows this
   is still overclaiming, the fallback is to **drop the affirmative card-level member entirely** and
   render only the unhappy members plus per-field source attributions — asymmetric honesty. I would
   accept that trade.
3. **Warning fatigue.** If per-field `untraced` is common and gets warning chrome, the icon becomes
   wallpaper. Guarded by §5.2, but if the measured rate of untraced figures turns out to be near
   100%, even the quiet clause becomes noise and the card-level line should carry the whole claim.
4. **The affirmative state may be rare in practice.** Nobody has measured how often a model's stop
   actually lands on a Convexa level. If the answer is "almost never", `all traced` is dead copy and
   the feature's visible value is entirely in the unhappy states — which changes where the weight
   should sit. I cannot resolve this in my lane; it is a measurement the build lane should report.
5. **Tolerance semantics leak into copy.** If the server matches within a band and I say `traces to`,
   a trader may read exact equality. The parenthesized source value is the entire mitigation; if the
   architect cannot supply that value, my copy claim weakens and I must say so.
6. **`no_trade` prose can still name levels.** A no-trade read that says "re-engage above 455"
   asserts a number while the card-level line says "no entry figures". Those two can look
   contradictory. Handled only if the named-levels row (§3c) ships or the tooltip's exclusion
   sentence is read; flag for R2.
7. **Fixing §7a inside this feature grows the diff.** Correct, but leaving it means attaching a
   grounding clause to a field whose *absence* is already mis-stated — grounding a lie. I would
   rather cut the named-levels row than skip §7a.

---

## Assumptions I'm making about the other two lanes

**Architecture**

- **A1.** The server emits, per checked field, a **closed token plus a human-readable source label
  plus the source's own value** (e.g. token `traced`, label `put wall`, value `412`) — so the FE can
  render `traces to Convexa's put wall (412)` with **zero** client-side matching or arithmetic. If
  the wire carries only a token with no source name and value, my affirmative copy collapses to a
  bare badge and I withdraw the "names its source" claim (UX-8 dies with it).
- **A2.** There is a **card-level** grounding token computed server-side. If the architect expects
  the browser to fold four field tokens into a card verdict, that is a client-side re-derivation and
  violates `digested-labels-not-raw-dump`; UX-1 and UX-2 both fail.
- **A3.** The per-field token set **distinguishes "compared, found no match" from "could not
  compare"**. If those collapse into one wire token, `absent-is-not-none` is broken at the wire and I
  cannot ship two literals — the failure is upstream of my render, not in it.
- **A4.** Verification runs at serialization against **the same snapshot the rec was generated from**,
  so a verdict is pinned and never needs re-checking in the browser. UX-14 assumes this.
- **A5.** The verification block is **optional on the wire** (older backend, `StubLLMProvider`, local
  fallback) and its total absence is **distinguishable at the client** from a `not_checkable`
  verdict. UX-5 and UX-6 both depend on this being two observable situations, not one.
- **A6.** If prose-named levels are in scope at all, they arrive as a **server-extracted list of
  (value, token, source)**. If they are in scope but only available as raw prose, I refuse to
  annotate them and the card-level tooltip's exclusion sentence stands (§3c does not ship).
- **A7.** `cap_check.cap_not_derivable_reason` stays a **closed token** and gains no free-text
  member; UX-20 renders it through a lookup.
- **A8.** A scripted scenario under `AI_REC_SCENARIOS_ENABLED` can produce a rec whose figures all
  fail to trace, so UX-16 is reachable from a fixture with no LLM call and no network.
- **A9.** The verification adds no field to the SSE payload and nothing on this dimension is
  live-derived — grounding is static by construction, which is what lets UX-14 be a real invariant
  rather than a promise.

**Product**

- **P1.** An untraceable number is **rendered and marked, not dropped.** The BRIEF explicitly leaves
  this open as "the PM/UX call at council"; my entire state matrix assumes render-and-mark. If PM
  rules *drop*, the per-field set collapses to two members, §3d's non-collapse rule changes meaning,
  and roughly half of §8 is rewritten. This is the single assumption most worth attacking.
- **P2.** `no_trade` stays a first-class complete answer and gains **no** grounding surface on its
  four `—` fields — only the "nothing to check" card-level member.
- **P3.** The `max_risk` single-figure prompt fix ships **in this feature**, so `cap_check` starts
  resolving to real verdicts. UX-21 exists because `within` is about to be visible in production for
  the first time.
- **P4.** Grounding is **advisory context, never a gate.** An untraced stop never blocks Accept or
  Act, never disables a control, never adds a confirmation step. If PM wants a blocking confirm on an
  untraced figure, that is a different feature with a different state matrix and I would want it
  scoped separately.
- **P5.** Nothing on this dimension reaches `opportunity_score` / `opportunity_tier` /
  `state_fingerprint`, nor the numbers carried into the Accept → ghost-trade / sim-order payloads.
  The Accept flow's sizing copy is unchanged.
- **P6.** Grounding is **always on** — no user toggle, no "hide checks" preference. A toggle would
  change what the absence of the line means and would reintroduce the exact ambiguity UX-6 closes.
- **P7.** Fixing §7a (the five fields rendering a bare `—`) is **in scope** for this feature. If PM
  cuts it, I want the named-levels row (§3c) cut first — a mis-stated absence is worse than a missing
  enhancement.
- **P8.** The intended user is unchanged and no explanatory onboarding, tour, or Settings surface is
  added. The tooltip in §3a is the only place the term is taught.
