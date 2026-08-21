# ai-rec-decision-card — spec

**Source brief:** `.spire/clusters/tech/contracts/ai-rec-decision-card/BRIEF.md`

**Route:** GATE V visual fast-path (frontend only)

**Status:** DRAFT — approved visual direction; awaiting owner approval of this written behavior contract

## 1. Goal + scope

Make the AI recommendation answer three questions in order:

1. What is the verdict?
2. What invalidates it and what is at risk?
3. What safe simulated action can I take next?

Long-form reasoning, data provenance, and request/export detail remain available on demand without
competing with those decisions.

**In scope:**

- Recompose the existing AI recommendation into a compact decision card and a desktop analysis
  drawer/mobile full-screen sheet.
- Replace ambiguous action labels with plain simulated-trading language.
- Centralize state-to-action policy for fresh, stale, stale-born, superseded, incomplete, no-trade,
  loading, gated, and unavailable reads while keeping live-tape/SSE status isolated from the static read.
- Preserve the existing persona, scenario, request-export, grounding, cap, and simulated-entry flows
  while reducing always-visible prose.
- Add focused component/flow tests and real-browser visual/accessibility verification.

**Out of scope:**

- AI prompt, response schema, grounding computation, recommendation logic, scores, tiers, gates,
  fingerprints, caps, cooldown rules, or data freshness rules.
- New API routes, fields, persistence, analytics, notifications, brokerage connectivity, or real-money
  order entry.
- A new trade-entry dialog, a new order form, automatic acceptance, or automatic order placement.
- A site-wide card redesign, new palette role, new font, new animation, or design-system amendment.
- Rewording server-authored values or inferring a confidence/quality score the server did not send.

**Future (deliberately deferred):** user research instrumentation comparing time-to-verdict and
simulated-flow completion after the redesign.

## 2. Architecture

### 2.1 Presentation boundary

- Keep `AiRecPanel` as the host for request state and existing handlers, but split the produced read
  into cohesive presentation pieces: context/provenance, verdict summary, decision grid, evidence
  summary, actions, and analysis surface.
- Add one pure presentation-policy derivation that consumes existing frontend state and returns the
  named visual state plus allowed actions. Rendering must consume this policy; individual buttons
  must not each re-derive freshness or completeness.
- The result card and analysis surface consume the pinned `RecResponse` and existing ticker bundle.
  Opening, closing, or reading analysis performs no recomputation and sends no request.
- The long-form reasoning, management bullets, levels/candidate evidence, cited contract, grounding
  detail, cap detail, request/export detail, and as-sent risk inputs move into the analysis surface.
  The decision card retains only the decision-critical summary described in §4.

### 2.2 Actionability policy

A read is **actionable** only when all of these are true:

- it is a produced `trade` decision;
- structure, at least one finite strike, expiration, and entry trigger are present as values;
- it is not stale because a newer bundle arrived;
- it was not born stale;
- its as-sent risk inputs have not been superseded by the current stored risk inputs;
- the user is signed in and the existing simulated-flow gate permits the path.

Time horizon, confidence, stop, target, max risk, and suggested size retain their existing closed
absence vocabulary but do not independently make a structurally complete trade unreadable. Existing
grounding rules still determine whether stop/target can prefill; untraced or unchecked figures remain
visible and are withheld from prefill exactly as today.

Policy outcomes:

- A fresh complete trade exposes `Review simulated trade`, `Create sim order`, and
  `Full analysis & data`.
- A stale, stale-born, superseded, or incomplete trade keeps the read visible but exposes no
  trade/position/order action. It shows one state-specific reason and the applicable recovery action.
- A no-trade result is complete, not an error. It exposes analysis/data only and never renders trade
  or order actions.
- Loading, signed-out, missing-key, cooldown, cap, no-edge, and unavailable states keep their existing
  gate semantics; the redesign changes hierarchy and copy placement, not eligibility or quotas.
- Scripted scenarios retain conspicuous scripted/simulated framing and follow the same completeness
  and freshness checks as a normal produced read.
- The recommendation is a static snapshot artifact. A live-tape/SSE drop does not make the read stale,
  change its content, or change its action policy; only the existing newer-bundle comparison does.

### 2.3 Existing simulated-flow boundaries

- `Review simulated trade` invokes the existing accepted-read handler and opens the one shared
  `TradeEntryDialog` position variant. No position is stored until the user confirms in that dialog.
- `Create sim order` invokes the existing order handler and opens the order variant of that same
  shared dialog. No simulated order is stored until the user confirms in that dialog.
- Dismiss removes the pinned recommendation using the existing dismiss behavior. It moves to a quiet
  header/overflow action instead of competing with the primary decision.
- No action in this feature can place or suggest that it placed a real-money order.

### 2.4 Information integrity

- The verdict composes only named structured values. It may display the decision/bias and structure,
  strike, expiration, horizon, or confidence that the response explicitly supplies; it must not
  synthesize a price relationship such as “near” from free prose or client arithmetic.
- The one-line thesis is existing model text, clipped by layout only. It is not rewritten by the
  client.
- The card-level grounding line uses the existing closed grounding mapping. Any count displayed is
  the server-provided `traced`/`checked` count; the browser never recounts figures.
- Up to three compact evidence indicators may summarize existing explicit statuses (grounding,
  cited-contract availability, cap check). Unsupported or absent evidence is omitted or shown with
  its existing honest absence literal; it is never filled with an invented positive state.
- Existing server-authored figures and absence literals keep their authorship typography rules.

### 2.5 Isolation and failure rules

- The analysis surface is local UI state. A failure inside it must not dismiss or mutate the pinned
  read, persona, risk inputs, ticker data, position book, or simulated orders.
- Closing the analysis surface returns focus to the control that opened it.
- A failed refresh preserves the existing read only where the current request hook already preserves
  it; the UI must label the failed request honestly and must not relabel the old read fresh.
- This feature introduces no alternate cache, stale timer, background refresh, or local copy of the
  recommendation.

## 3. Acceptance criteria (with user stories)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a trader, I want the answer before the rationale so I can decide where to focus. | A fresh produced result orders its visible content as context/provenance, verdict, structure metadata, one-line thesis, decision grid, grounding/evidence summary, then actions; long-form reasoning is not inline in the default card. | review |
| AC-2 | As a trader, I want the verdict to use facts the read actually supplied. | The verdict and metadata display only structured response values or existing closed absence literals; the browser does not infer a price relationship, quality score, or confidence meaning. | test |
| AC-3 | As a risk-first trader, I want the decisive risk facts grouped together. | A trade result presents a two-column decision grid ordered `Max risk`, `Invalidation`, `Entry`, `Target`; each value uses the existing value/absence rendering and associated help text. | review |
| AC-4 | As a desktop user, I want the next action to be easy to find. | At a 1440×900 viewport with the normal two-column Ticker layout, the verdict, decision grid, and `Review simulated trade` control are visible without scrolling inside the recommendation card. | review |
| AC-5 | As a trader, I want actions that describe the flow they open. | The fresh complete trade actions read `Review simulated trade`, `Create sim order`, and `Full analysis & data`; `Accept into ghost trade`, `Act as sim order`, and `Show full analysis` are absent from the result UI. | review |
| AC-6 | As a trader reviewing an AI idea, I want confirmation before anything is tracked. | Selecting `Review simulated trade` opens the existing shared simulated-position dialog with current prefill rules, and no position is stored before dialog confirmation. | test |
| AC-7 | As a trader setting a conditional simulation, I want confirmation before an order exists. | Selecting `Create sim order` opens the existing shared dialog's order variant, and no simulated order is stored before dialog confirmation. | test |
| AC-8 | As a trader, I want supporting detail without losing ticker context. | Selecting `Full analysis & data` opens a right-side drawer on desktop containing the full reasoning, management guidance, levels/candidates, cited-contract and grounding detail, cap detail, provenance/as-sent inputs, and request-export entry available for that read. | review |
| AC-9 | As a mobile user, I want the analysis to remain readable. | At 393px the same control opens a full-screen sheet with a persistent title/close control and a single vertical content flow; the page gains no horizontal overflow. | test |
| AC-10 | As a keyboard user, I want analysis to behave as a proper modal surface. | Opening analysis moves focus into it, Tab/Shift+Tab remain within it, Escape closes it, and close returns focus to `Full analysis & data`; visible focus treatment remains present. | test |
| AC-11 | As a trader reading a newer market snapshot, I do not want to act on an old read by mistake. | When a newer bundle makes the read stale, the pinned read remains visible with its original as-of value, both simulated action controls are absent, and `Refresh analysis` is the primary recovery action. | test |
| AC-12 | As a trader, I want a read generated from old data to be unmistakable. | A stale-born result shows distinct stale-at-generation copy, exposes no simulated action, and offers refresh when the existing gate allows it. | test |
| AC-13 | As a trader who changed risk inputs, I want actions to use the right assumptions. | When current risk inputs differ from the as-sent risk inputs, the read states that the assumptions changed, exposes no simulated action, and offers a fresh analysis when the existing gate allows it. | test |
| AC-14 | As a trader, I do not want an incomplete plan presented as executable. | A trade read missing structure, a finite strike, expiration, or entry trigger names the missing position-defining fields, exposes neither simulated action, and retains analysis/data access. | test |
| AC-15 | As a trader, I want “no trade” to read as a confident complete outcome. | A no-trade result presents `No trade — sit this one out`, its one-line rationale, and re-engagement conditions when supplied; it does not render the four-field dash grid or either simulated action. | test |
| AC-16 | As a trader, I want the system to remain honest while analysis is running. | Loading shows the existing in-progress meaning and no verdict, old-result action, success copy, or duplicate request action. | test |
| AC-17 | As a trader, I want an unavailable read to have a clear recovery path. | Generic request failure admits that no read was produced, leaves the rest of the Ticker dashboard usable, and shows `Retry` only when the existing gate allows retry. | test |
| AC-18 | As a signed-out visitor, I want one clear next step. | The recommendation surface presents the existing sign-in gate without persona, quota, key, or simulated-action controls and performs no recommendation request before sign-in. | test |
| AC-19 | As a user without a usable AI key, I want to know why analysis is blocked. | Missing own/shared key and exhausted shared allowance retain their distinct existing explanations and Settings recovery actions; they do not look like generic errors or loading. | test |
| AC-20 | As a rate-limited user, I want the timing constraint to be clear. | Cooldown and daily-cap states retain their existing server-vouched remaining/reset values, disable or replace the request action as today, and keep request/export data accessible. | test |
| AC-21 | As a user at the quiet no-edge gate, I want the override to remain deliberate. | The no-edge state explains that no fresh actionable edge was found and keeps the existing `Ask anyway` override and quota consequences; it does not present a produced verdict. | test |
| AC-22 | As a trader during a live-tape interruption, I want the pinned analysis to keep its true static meaning. | An SSE/live-tape drop leaves the recommendation content, freshness label, and action policy unchanged; it does not add offline styling or relabel the read stale, while live-derived ticker surfaces continue their existing offline treatment. | test |
| AC-23 | As a skeptical trader, I want to understand what Convexa could verify. | Every produced trade displays exactly one existing card-level grounding statement; server-provided checked counts remain byte-faithful, and absent, untraced, not-checkable, and local-rules states remain distinct. | test |
| AC-24 | As a trader opening a prefilled flow, I do not want unchecked values silently inserted. | Existing grounding gates continue to withhold untraced, not-checkable, or no-grounding stop/target figures from the shared dialog and preserve the existing reason text. | test |
| AC-25 | As a privacy-conscious user, I want request transparency in every state. | `What’s sent to the AI` remains directly reachable whenever no produced read is shown and remains reachable inside `Full analysis & data` whenever a produced read is retained; no-trade, incomplete, stale, unavailable, cooldown, cap, and missing-key states preserve one of those paths. | test |
| AC-26 | As a user changing persona, I want to know which persona authored the visible read. | Before requesting, a compact accessible persona control selects the next read; after production, a static `Persona · {response persona name}` provenance label identifies the pinned read, and changing the next-read selection does not relabel or recompute it. | test |
| AC-27 | As an operator viewing a scripted scenario, I want it impossible to confuse with a live AI read. | Scenario-produced results retain the scripted warning with icon plus `SIMULATED / advisory` framing and use the same freshness/completeness action policy as other trade results. | test |
| AC-28 | As a user, I want controls I can perceive and operate. | Every icon-only or help control has an accessible name, tooltip/help is reachable by keyboard and pointer, all coarse-pointer targets are at least 44px, and status is not conveyed by color alone. | test |
| AC-29 | As a mobile user, I want the decision card to fit the product shell. | At 393px the card, metadata, decision grid, state strips, and actions form one vertical flow with no clipped text, nested horizontal scroller, or page overflow. | test |
| AC-30 | As a light- or dark-mode user, I want the redesign to remain Convexa. | Both schemes use existing theme/type/elevation tokens, warnings use warning color plus icon, figures obey authorship typography, and the feature adds no hardcoded component hex, green/red decoration, convex arc, or animation/keyframe family. | test |
| AC-31 | As the product owner, I want a contained UI redesign. | `apps/api` and recommendation/scoring/fingerprint behavior have no feature diff; the existing shared trade dialog remains the only simulated-entry component. | test |
| AC-32 | As a user who completes or cancels a simulated flow, I want predictable return behavior. | Cancel returns to the unchanged pinned read; successful position/order confirmation uses the existing confirmation behavior and does not auto-dismiss, refresh, or rewrite the recommendation. | test |

## 4. UI + interaction

### 4.1 Default information architecture

**Request/idle:**

1. Header: `AI recommendation · {ticker}` and `What’s sent to the AI`.
2. Compact `Persona` selector and scenario selector only when their existing gates allow them.
3. One short advisory line.
4. Primary action: `Analyze current snapshot`.

**Fresh complete trade:**

1. Context row: freshness, `SIMULATED / advisory`, pinned persona, as-of snapshot, and scripted state
   when applicable.
2. Verdict: exact decision/bias; structure plus supplied strike/expiration/horizon/confidence as
   supporting metadata.
3. One-line thesis from existing model output.
4. Two-column decision grid: `Max risk`, `Invalidation`, `Entry`, `Target`.
5. Exactly one card-level grounding line; zero to three source-vouched evidence indicators.
6. Primary `Review simulated trade`; secondary `Create sim order`; tertiary
   `Full analysis & data`. Dismiss is quiet and visually separate.

**Analysis surface order:**

1. Read summary and provenance.
2. Why / full analyst rationale.
3. Manage the trade / re-engage conditions.
4. Levels in play and what the numbers said.
5. Cited contract, grounding clauses, and cap annotation.
6. Risk inputs and open-position context sent with the request.
7. `What’s sent to the AI` export/detail entry.

The desktop surface is a right-side drawer sized to preserve meaningful ticker context. At the small
breakpoint it becomes a full-screen sheet. It has one internal vertical scroll region and no nested
scroll region inside analysis sections. There is no new entrance/exit animation beyond MUI behavior
already admitted by the design system.

### 4.2 Component-state inventory and AC map

| State | What the user sees | Available next action | Must not happen | ACs |
|---|---|---|---|---|
| Idle / no read | Compact request context, advisory line, current snapshot hint | `Analyze current snapshot`; request export | No verdict or result skeleton persists | 18, 25, 26 |
| Loading | Honest in-progress state for ticker/persona | Wait; request export; existing cancellation behavior only if already present | No success, verdict, duplicate request, or simulated action | 16, 25 |
| Fresh complete trade | Decision-first card with source-vouched summary | Review simulated trade; create sim order; analysis/data; dismiss | No long-form report inline; no mutation on open | 1–10, 23–26, 28–32 |
| Fresh local-rules trade | Same card with exact local-rules grounding statement | Same as complete trade only when position-defining fields are present | Never label the result as an AI-authored read | 2, 14, 23, 31 |
| Fresh no-trade | Complete no-trade verdict, rationale, supplied re-engage conditions | Analysis/data; dismiss; later new analysis | No dash grid and no simulated action | 15, 23, 25 |
| Incomplete trade | Verdict plus named missing position-defining fields | Analysis/data; refresh when eligible; dismiss | No review/order action | 14, 23–25 |
| Stale — newer snapshot | Old read retained with original as-of and stale explanation | `Refresh analysis` when eligible; analysis/data; dismiss | No simulated action; no silent re-run or “fresh” label | 11, 20, 25 |
| Stale-born | Distinct at-generation warning with snapshot age when supplied | Refresh when eligible; analysis/data; dismiss | No simulated action or conflation with newer-snapshot stale | 12, 25 |
| Superseded risk inputs | Old read plus earlier-input explanation | Fresh analysis when eligible; analysis/data; dismiss | No simulated action using outdated assumptions | 13, 20, 25, 26 |
| Live-tape/SSE offline — deliberately not a recommendation state | The pinned static read remains byte-stable; live ticker surfaces own their existing offline treatment | Whatever actions the read's independent freshness/completeness policy already allows | No offline styling, stale label, or action change on the recommendation | 22 |
| Generic unavailable | Honest unavailable copy | Retry when eligible; request export | No stale read presented as a new result | 17, 20, 25 |
| Signed out / stale session | Existing auth gate | Sign in; request export where existing policy permits | No persona, quota, key, request, or simulated action | 18, 25 |
| Missing key / shared key unavailable | Distinct key/setup state | Existing Settings CTA; request export | No generic failure wording | 19, 25 |
| Shared allowance exhausted | Distinct daily-use explanation | Existing Settings CTA; request export | No promise of immediate free retry | 19, 20, 25 |
| Cooldown | Remaining time from existing gate | Wait; request export | No early request or invented countdown | 20, 25 |
| Daily cap | Existing reset time and cap explanation | Wait/manage key as already allowed; request export | No request until existing gate permits it | 20, 25 |
| Quiet no-edge gate | Existing no-edge explanation | `Ask anyway`; request export | No produced verdict before override completes | 21, 25 |
| Scripted scenario result | Scripted warning plus simulated framing | State-policy-dependent result actions | Never masquerade as a current live AI read | 27 |
| Position/order dialog open | Existing shared confirmation surface | Edit, confirm, cancel | No pre-confirm mutation; no new dialog implementation | 6, 7, 24, 31 |
| Confirmed / cancelled flow | Existing outcome feedback or unchanged card | Continue from existing flow | No automatic recommendation rewrite/dismiss | 32 |
| Dismissed | Idle request state | Analyze current snapshot | No hidden mutation to positions/orders | 32 |

### 4.3 Copy contract

| Current | Replacement | Meaning |
|---|---|---|
| `Get AI recommendation` | `Analyze current snapshot` | Starts a recommendation request against the displayed snapshot. |
| `Accept into ghost trade` | `Review simulated trade` | Opens the shared position-entry review; does not store before confirmation. |
| `Act as sim order` | `Create sim order` | Opens the shared simulated-order setup; does not store before confirmation. |
| `Show full analysis` | `Full analysis & data` | Opens the non-mutating analysis/detail surface. |
| `Get a fresh recommendation` | `Refresh analysis` | Requests a new read under existing gate/cap/cooldown rules. |

Existing closed-set absence, grounding, cap, provenance, stale, key, cooldown, quota, scenario, auth,
export, and confirmation copy remains authoritative unless this table names a replacement. The
implementation keeps user-facing AI-recommendation copy centralized rather than scattering literal
strings across new components.

### 4.4 Design authority

**Binding canon:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET`).

The approved wireframes are hierarchy/layout references, not a second token authority. Implementation
must use the Curvature Terminal's Archivo, IBM Plex Sans/Mono authorship register, amber discipline,
signal links, warning-orange-plus-icon rule, named elevations, 10px card radius, focus treatment, and
44px coarse-pointer floor. It must not copy literal colors from the HTML wireframe.

## 5. Error handling

- Recommendation request errors remain contained to the AI recommendation widget and do not disable
  the rest of the Ticker dashboard.
- Error, unavailable, stale, stale-born, superseded, cap, cooldown, missing-key, and signed-out messages
  stay distinct; no two are collapsed into generic “try again” copy when their recovery differs.
- If refresh is blocked by cooldown/cap/key state, the read stays labeled degraded and the refresh
  control exposes the existing honest gate state; simulated actions remain absent.
- If analysis content is partially absent, the drawer shows the existing honest literal or omits a
  non-required section. It never manufactures placeholder prose, evidence, a number, or a positive check.
- Analysis rendering and focus cleanup must not throw when the result is no-trade, incomplete,
  pre-grounding, or from a scripted/local-rules producer.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/ai-rec-decision-card/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** `NO_BACKEND_CHANGE`. The redesign consumes current AI
recommendation, bundle, gate, grounding, export, risk-input, and simulated-flow interfaces unchanged.

## 7. Testing strategy

- RED/GREEN unit tests for the pure presentation-policy derivation across fresh complete, no-trade,
  incomplete, stale, stale-born, superseded, scripted, local-rules, and gated inputs, plus an SSE-drop
  independence case. These tests own action presence/absence because an unsafe action is easy to miss
  visually.
- Component tests for the default hierarchy and the state-specific recovery/action surfaces. Keep the
  existing risk, absence-literal, grounding, privacy/export, persona, scenario, auth, key, cap, cooldown,
  and no-edge assertions green while updating approved labels/layout assertions.
- One integration flow for fresh read → review simulated trade → shared dialog → cancel/confirm, and one
  for fresh read → create sim order → shared dialog → cancel/confirm. Assert no pre-confirm persistence.
- Browser keyboard test for open, initial focus, focus containment, Escape close, and focus return.
- Playwright/browser checks at normal desktop width and 393px for information order, drawer/sheet mode,
  no card-internal scroll, no clipping, and no horizontal page overflow in dark and light schemes.
- Structural tests retain zero hardcoded hex, warning-icon, single-motion, type/authorship, one shared
  simulated-entry dialog, and no-overflow enforcement.
- Final verification runs dashboard typecheck, focused AI-rec tests, relevant dashboard suite,
  production build, and a real rendered inspection. Record exact commands and exit codes.

Visible intentional copy and hierarchy ACs are marked `review`; state/action safety, negative space,
focus, overflow, interface invariants, and persistence boundaries are marked `test` because those
regressions are silent or expensive.

## 8. Guardrails this feature must not break

- `[theme-token-discipline]`: no component hex, raw brand constants, palette fork, or light-mode lock.
- `[live-vs-static-isolation]`: the recommendation is static; an SSE drop does not dim, mark stale, or
  change its actions. Newer-bundle stale, stale-born, and unavailable remain separate states.
- `[single-motion-moment]`: no new keyframe or orchestrated animation family.
- `[single-shared-sim-entry-dialog]`: both simulated paths use the existing shared dialog variants.
- `[no-real-order-path]`: all action and confirmation copy remains explicitly simulated/paper.
- `[ai-asserted-numbers-are-traceable]`: no client-invented verification, counts, or prefill authority.
- `[absent-is-not-none]`: preserve the closed absence and grounding vocabularies.
- `[additive-keeps-score-byte-identical]`: no backend, score, tier, gate, or fingerprint behavior diff.
- `[structural-over-prose-enforcement]`: action policy, pre-confirm boundary, focus path, and 393px fit
  receive executable guards.
- `[model-read-carries-its-assumptions]`: persona, as-of, simulated framing, and degraded status remain
  visible on the decision surface.

## 9. Open questions

None.
