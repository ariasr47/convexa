# R1 — ux position: broker-connect

> Lane: component states · user-facing copy · design direction (DESIGN_RULES §1 front half).
> No server internals, no endpoint design — field names below are the vocabulary the UI consumes,
> not a payload spec. Styling canon: `convexa-design` skill + `tokens.ts`; copy canon: honest-data
> house style (`[model-read-carries-its-assumptions]`, `[absent-is-not-none]`, scanner poll-honesty).

## Position

### 1. The tab label: "Live" must not sit above polled data — rename the visible tab to **Broker**

The scanner precedent is binding and on point: *"rows are poll-based, never 'live' — the word is
absolutely forbidden on the table."* This feature fills the Positions page's second tab with
**polled snapshots** of a real book. A tab literally labeled **Live** directly above rows we are
forbidden to call live is the design authority contradicting itself in one glance — the exact
failure the scanner's authority had to amend mid-build.

Position: the **visible tab label becomes `Broker`** (internal names, routes, testids may keep
`live` for continuity — the ban is on what the trader reads). "Broker" says what the tab actually
is: the real book, read from a broker, at a stamped moment. The one permitted appearance of the
word "live" on this surface is the house-style negation in the header honesty line ("snapshot,
never live") — as a **denial only**, never a descriptor. If the PM holds the "Live" name as
product framing, that is an R2 conflict I am explicitly teeing up.

### 2. The Live tab's render states — a closed vocabulary, not a boolean ladder

The FE renders from a **closed state lookup** (never derived from `positions.length` — the
`bundle-events` rule carried to this surface). Nine render states; each gets its own copy below.

| # | State | Trigger (UI-visible fields) | Surface |
|---|-------|------------------------------|---------|
| S1 | `never_connected` | no credential stored | Full-tab empty state with the connect CTA (replaces the LOCKED placeholder) |
| S2 | `pending_first_sync` | credential stored, first fetch in flight | Skeleton rows + "Syncing…" line — **no numbers, no zero-count** |
| S3 | `ok` | fetch succeeded, ≥1 position | Provenance header + read-only positions list |
| S4 | `empty_confirmed` | fetch succeeded, broker reports zero positions | Distinct confirmed-empty state, with its check timestamp |
| S5 | `unknown` | credential stored, book never successfully read (or read-state unrecoverable) | "We don't know" state — must never render as S4 |
| S6 | `stale` (modifier on S3/S4) | last good read older than the refresh cadence | Data stays rendered, frozen, stamp foregrounds the age |
| S7 | `degraded` | most recent poll attempt failed | Tab-scoped banner over last-known rows (if any; else S5 copy) — **sim tab, bundle, SSE, everything else untouched** |
| S8 | `reauth_required` | broker rejected the stored credential | Warning-class banner + Reconnect CTA; last-known book stays below with its stamp |
| S9 | first-load skeleton | tab mounted, state not yet known | Skeleton — visually distinct from S7 per canon (cold-load ≠ offline-degrade ≠ unavailable) |

Notes binding the states:

- **S4 vs S5 is `[absent-is-not-none]` carried to the render**, exactly like the event calendar's
  `none` vs `unknown`. Both can arrive with an empty positions array; the state token is the sole
  disambiguator, and the FE must be structurally unable to show "no open positions" without the
  confirmed state. This is the highest-severity honesty line in the feature: asserting an empty
  book nobody confirmed is a fabricated claim about real money.
- **S6/S7/S8 are not one "error state."** Stale = the picture is old; degraded = the last attempt
  failed; reauth = the credential is dead and the trader has a specific action. A generic
  catch-all collapsing them is a silently-regressing failure — marked `test` below.
- **SSE independence:** broker data is polled REST, static-family. It does **not** dim on an SSE
  drop (`[live-vs-static-isolation]` — this surface's freshness story is the as-of stamp, not the
  stream chip).
- **S7 isolation copy names it:** the degraded banner explicitly says the rest of Convexa is
  unaffected, because `[best-effort-isolated-or-null]` is a product promise here, not plumbing.

### 3. The as-of / freshness treatment — the provenance stamp is the surface's spine

Every broker datum renders under a **provenance header**:

> **Webull · read-only** &nbsp;·&nbsp; `as of 2:41:07 PM` &nbsp;·&nbsp; refreshes about every
> {cadence} — a snapshot, never live.

- The timestamp renders in the **mono data face with `tabular-nums`** — it is a datum, not chrome.
- The cadence figure comes from the wire (a `refresh_seconds`-style field), never hardcoded in FE
  copy — a hardcoded "every 60s" goes stale the day the poll changes.
- Stale (S6): the stamp does not move or vanish; a quiet appended clause carries the age —
  `as of 2:41 PM · couldn't refresh since` — data stays rendered and frozen (scanner precedent:
  a stale row keeps its frozen price *with its stamp*). No red, no blanking.
- Tooltip on the stamp: *"Your Webull positions are read on a schedule, not streamed. This is the
  book as Webull reported it at this time — prices and P/L can have moved since."*
- **No pulsing dot, ever.** The pulsing live dot is the Ticker page's SSE vocabulary; putting one
  here would claim streaming. Reserved.

### 4. Real vs sim distinction — structural and typographic, never fear-styled

- **The tab boundary is the primary separator** (already shipped). Within the Broker tab:
  the `Webull · read-only` badge in the header (neutral steel-outline chip — **not amber**, amber
  is brand-structural; **not green/red**, those are reserved for P/L direction), the as-of stamp
  on the surface, and per-row absence of every write affordance.
- **READ-ONLY is rendered as absence, not as disabled controls.** Broker rows carry **no** Close,
  no Cancel, no fill-mode, no entry affordance of any kind — the controls do not exist on these
  rows, they are not grayed-out versions of sim controls (a disabled Close button implies a
  Close exists to be enabled). Per the narrowed `[single-shared-sim-entry-dialog]`, **nothing on
  this surface opens or references `TradeEntryDialog`** in any mode or variant.
- The **one** action a broker row may carry is the advisory read the brief names: building a
  reassessment that references the real holding. Label: `Build reassessment` — advisory, no
  order path. The shipped suppression rules travel with it (multi-leg / multi-position
  suppression is a render decision; the "Silence here doesn't mean nothing changed" copy family
  applies).
- **No fear styling:** real positions are not tinted, bordered red, or badged with warnings for
  being real. Honesty is carried by the stamp and the read-only framing. Warning styling (burnt
  orange + icon, per brand rules — hue never carries warning alone) is reserved for S8, where
  something actually needs the trader's action.
- Sim tab is untouched: SIMULATED framing, entry dialog, all shipped copy stay as-is.

### 5. Copy — exact strings (drafts; binding intent, wordsmithing open)

**Tab empty state (S1):**
- Heading: `Connect your brokerage`
- Body: `Convexa can read your Webull positions with your own API keys — so decisions run
  against the book you actually hold, not a hand-copied one. Read-only, absolutely: Convexa
  never places, changes, or cancels an order.`
- CTA: `Connect Webull` → deep-links to Settings `#brokerage` (see §7).
- Sub-line: `Keys are saved encrypted and never shown again. You can disconnect any time.`

**S2 syncing:** `Reading your Webull book for the first time…` (skeleton rows; no counts).

**S4 confirmed empty:** `Webull reports no open positions.` + caption
`Checked at {time}. This is a confirmed read — not a guess.`

**S5 unknown:** `Convexa hasn't been able to read your Webull book yet. It won't show you an
empty book it hasn't confirmed.` + `Try again` action.

**S7 degraded banner (info-class, tab-scoped):** `Couldn't reach Webull this cycle — showing
your book as of {time}. Everything else in Convexa is unaffected.` (With no last-known book, the
body falls through to S5 copy.)

**S8 reauth (warning-class, burnt orange + icon):** `Webull stopped accepting the saved key.
Reconnect in Settings to resume reading your book — your last confirmed book (as of {time})
stays below.` CTA: `Reconnect in Settings`.

**Imported structure honesty (`Custom` is residue, never judgement):** reuse the shipped
`STRUCTURE_TIP` verbatim; the import-specific tip on a `Custom` broker row:
`Convexa doesn't have a name for this leg shape, so it shows the legs as Webull holds them.
Nothing is wrong with the position — a name is a convenience, not a verdict.` The recognizer's
no-confidence-measure rule is copy-visible: no "probably a condor", no percentages, ever.

**The fifth not-a-number literal — `not provided`:** the shipped four (`—` / `unavailable` /
`not recorded` / `no basis`) don't cover a fact the **broker payload never carried**. New
literal `not provided`, tip: `Webull's data for this position doesn't include this detail.
Convexa won't guess it — nothing is missing from your account, only from the feed.` (Distinct
from `not recorded`, which is about our own saved records.)

**P/L basis on broker rows** (`[model-read-carries-its-assumptions]`): whichever basis lands
(broker-reported vs our mark ladder — an open payload question), the row's P/L tip **names it**:
either `Webull's own unrealized P/L, as of the stamp above` or the existing mark-ladder basis
copy. A dollar figure with an unnamed basis does not ship.

### 6. The credential surface — Settings section "Brokerage", rhyming with the AI-key section

Same skeleton as `AiKeySection` (the shipped pattern), same security floor rendered in copy:

- Heading `Brokerage` / helper: `Connect Webull with your own Individual OpenAPI keys. Convexa
  reads positions only — it never places, changes, or cancels an order.`
- **Write-only entry:** App Key + App Secret fields (password-type, no reveal/show/copy control
  anywhere), saved state shows `Webull · key ····{last4}` in the mono face + caption
  `Saved encrypted. Never shown again, never sent to this browser.`
- Actions: `Replace keys` (rotate — same two-field form, overwrites) and `Disconnect` behind an
  inline confirm: title `Disconnect Webull?`, body `Convexa deletes your keys and stops reading
  your positions. Nothing changes at Webull — this only removes what Convexa stored.` Confirm
  button `Disconnect` / cancel `Keep connection`.
- Anonymous → the shipped `SignInPrompt` pattern (credential is per-account); storage-unavailable
  → the shipped contained info-note pattern (never error-red, never a dead-end).
- Save/remove errors **never echo any part of a key** (the AiKeySection floor, restated).

### 7. Where the connect affordance lives — both doors, one home

Position: **credentials live in Settings** (secrets belong where the app already keeps secrets;
per-account, server-gated, the AI-key section is one scroll away and the mental model transfers),
and **the Broker tab's S1 empty state carries the primary discovery CTA**, deep-linking to the
Settings `#brokerage` anchor (the `#ai-key` anchor precedent). One credential home, two doors.
A key-entry form embedded in the Positions page is rejected: it would put secret entry on a
trading surface and duplicate the credential UI in two places that would drift.

### 8. Acceptance-criterion candidates → states → `Verify by`

(For the synthesizer's §3 table. Risk-based per qa-verify §4 — invariants and negative space are
`test`; visible intentional presence/wording is `review`. No per-AC test mirroring.)

| AC candidate | State(s) | Verify by | Why |
|---|---|---|---|
| Unknown book never renders as confirmed-empty (S5 ≠ S4, enforced by closed state lookup, not array length) | S4, S5 | **test** | Silently-regressing fabricated claim — highest risk in the feature |
| No entry/exit/close/order affordance exists on any broker row; no `TradeEntryDialog` import/reference on the broker surface | S3 | **test** | Negative space; the `[no-real-order-path]` boundary in render form |
| The word "live" appears nowhere on the broker surface as a descriptor (negation-only allowance in the one header phrase) | all | **test** | Negative space; scanner-precedent forbidden-word scan |
| Broker fetch failure leaves the Sim tab, bundle widgets, and SSE surfaces rendering (isolation) | S7 | **test** | Invariant `[best-effort-isolated-or-null]` at the render layer |
| An as-of stamp is present whenever any broker datum renders (S3/S4/S6/S7/S8) | S3–S8 | **test** | Invariant; a stamp-less real number is the poll-honesty regression |
| Reauth (S8) renders distinctly from generic degraded (S7) | S7, S8 | **test** | A generic catch-all silently collapses them |
| No credential fragment is ever rendered or echoed after save (masked last4 only) | Settings | **test** | Security floor, negative space |
| Empty/degraded/reauth copy, CTA presence + deep-link target, badge wording/placement, stamp format, tooltips | S1, S4, S5, S7, S8 | **review** | Visible, intentional; a human reads it once |
| `Custom` structure + `not provided` literal render with their tips | S3 | **review** | Visible copy presence |
| No fear styling: no red/warning treatment on rows for being real; green/red only on P/L direction | S3 | **review** | Visible restraint call (the className-identity mechanism exists if QA wants it) |

### 9. Design direction (DESIGN_RULES §1 front half — lands in SPEC §4)

**Brief pin.** Subject: *the owner's actual Webull book, rendered as a stamped snapshot ledger.*
Audience: the owner — a single trader who lives in dark broker terminals and distrusts dashboards
that lie. Single job: **show the risk actually carried, and exactly how old that picture is.**

**Structure before style.** One sentence: a provenance header (broker badge · as-of stamp ·
refresh note) over the same leg-first table/card grammar the sim book already uses, minus every
write affordance, closed by nothing — no footer decoration. The trader should read the Broker tab
as *the same book grammar, different provenance*, not as a new product area.

**Token plan.** No new tokens; zero hex (`[theme-token-discipline]`).
- **Color:** existing ink/panel canvas; the broker badge is a neutral steel outline chip; burnt
  orange + icon for S8 only; green/red untouched, P/L-direction only; amber not spent here (the
  accent is spent, not sprinkled — and this surface's personality is the stamp, not a color).
- **Type:** existing stack; the as-of timestamp and every figure in the mono data face,
  `tabular-nums`; no stat value in a heading element.
- **Layout:** provenance header as a quiet single row pinned above the list; states S1/S4/S5 are
  designed empty states (copy + one action), never bare text in a void.
- **Signature:** **the ledger stamp** — the mono `as of` provenance block. It is the one element
  this surface is remembered by, derived from the subject's own world (a broker statement's
  timestamp), and it does double duty as the feature's core honesty mechanism.

**Self-critique (defaults rejected, per §1.4):** a pulsing green "Connected" dot (claims
streaming — rejected; the dot is the Ticker's SSE vocabulary); a `LIVE` badge (forbidden word);
red/danger framing because money is real (fear styling — rejected; honesty ≠ alarm);
bank/padlock iconography on the connect state (cliché; the 🔒 emoji dies with the placeholder);
a perpetual sync spinner in the header (violates the one-motion-moment budget — the stamp text
updates, nothing animates). Quality floor: keyboard focus on the CTA/Retry/Reconnect controls,
44px targets, ≥11px labels, no 393px overflow (the table reuses the shipped `<sm` card collapse),
reduced-motion respected by inheritance (no new motion is introduced).

## Risks I see

- **The tab-name fight.** If "Live" survives as the visible label, the surface contradicts the
  poll-honesty rule structurally and every downstream copy decision inherits the lie. I'd rather
  lose this in R2 explicitly than discover it at GATE V.
- **Payload-shape unknowns leak into copy.** Options/multi-leg shape is an open question until
  the capture. If Webull reports positions in a shape that doesn't decompose cleanly into
  `Leg[]`, the `Custom`/`not provided` copy carries more weight than designed — the honesty
  literals must be able to carry a *whole position*, not just a field.
- **P/L basis ambiguity.** If both a broker-reported P/L and a Convexa mark-ladder P/L exist,
  showing either without naming it — or worse, mixing them across rows — breaks
  `[model-read-carries-its-assumptions]` where it hurts most (real dollars).
- **S5 vs S2 vs S9 blur in implementation.** Three "nothing to show yet" states with different
  meanings; if the build collapses them into one spinner, `[absent-is-not-none]` fails silently.
  The closed render-state lookup is the defense; the `test` markings above are the tripwire.
- **Reassess-on-real scope.** If the reassessment affordance slips out of v1, the broker rows
  have zero actions — fine, but then the S3 design must not feel like a dead-end (the stamp and
  tooltips carry the value); if it slips *in* late, the suppression copy family must come with it.
- **Reconnect friction.** S8 sends the trader to Settings mid-task. Acceptable for v1 (one
  credential home), but if rotate-in-place gets requested later it must not become a second
  credential form on the Positions page.

## Assumptions I'm making about the other two lanes

- The architect delivers connection state and book state as **closed enums on the wire** (e.g. a
  connection status covering not-connected / connected / auth-rejected, and a book state covering
  `unknown | empty | ok`), so the FE never infers S4-vs-S5 from an empty array — falsified if the
  wire carries only a positions list plus an HTTP status.
- Credential-rejected is **distinguishable from transient broker failure on the wire** (S8 vs S7
  need different renders and different trader actions) — falsified if both surface as one error
  shape.
- Every broker read carries a **server-side `as_of` timestamp and the refresh cadence** as data,
  so the FE never fabricates or hardcodes either — falsified if the FE is expected to stamp
  arrival time client-side.
- `BrokerPosition` projects through the `PositionView` seam into a **leg-shaped structure the
  existing leg-first render components can consume read-only**, so the Broker tab reuses the sim
  book's table/card grammar instead of a parallel component tree — falsified if the architect
  gives the Live tab its own unrelated view model.
- The credential endpoints follow the **byo-ai-key contract shape** (write-only set, masked
  last4 + `set` flag status read, delete; storage-unavailable as a contained 200-class state) —
  falsified if the status read returns anything richer or the flow needs a multi-step handshake
  (e.g. an OAuth-style redirect) that breaks the Settings-section pattern.
- Broker fetch failures **cannot produce a tab-level hard error that unmounts the Positions
  page** — the failure domain is the Live/Broker tab's payload only — falsified if a broker
  fault can 5xx a shared endpoint the page depends on.
- The PM scopes v1 to **exactly one broker (Webull), view-only, with the reassessment reference
  as the sole action on a real holding** — falsified if v1 adds manual-refresh SLAs, multi-broker
  UI, or any real-row action beyond the advisory read.
- The PM treats "Live tab" in the brief as a **pointer to the existing surface, not a binding
  visible label** — falsified if the PM's framing pins the trader-visible word "Live"; that is
  the R2 conflict I expect to fight.
- The PM accepts that **credentials live in Settings** with the Positions-page empty state as a
  deep-linking door, not an embedded form — falsified if the PM requires connect-in-place on the
  Positions page.
- system-6 (security council scope: threat model, credential lifecycle, egress) lands **no
  UI-visible requirement beyond what §5/§6 already render** (write-only entry, masked hint,
  rotate/delete, no-echo errors) — falsified if it mandates, e.g., a visible last-used audit
  trail or a re-auth challenge UI this position hasn't designed.
