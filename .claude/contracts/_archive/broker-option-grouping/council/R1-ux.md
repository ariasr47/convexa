# R1 — ux position: broker-option-grouping

## Position

### 0. Scope of this document

Component states, where each datum surfaces, microcopy, tooltip text, degraded wording, and the
`DESIGN_RULES` front half (brief-pin → structure → token plan → self-critique). **No acceptance
criteria are emitted here** (the dispatch excludes them); §9 gives verification-kind *guidance* the
PM's AC table can adopt, not ACs. No math, no data structures, no endpoints.

Everything below is grounded on the shipped surface: `BrokerPositionRow.tsx`,
`BrokerPositionCard.tsx`, `copy.ts`, `BrokerTabPanel.tsx`, `brokerView.ts`, and the shipped
disclosure precedent `positions/LegDisclosure.tsx`.

---

### 1. Pin the brief (DESIGN_RULES §1.1)

- **Subject.** A ticker's option legs *as Webull actually hands them over*: a bare underlying
  symbol, a signed quantity, a per-unit cost, and nothing else. No strike, no expiry, no right, no
  multiplier. The subject's own world is a **ledger**, not a strategy diagram.
- **Audience.** One trader — the owner — reading his own real money in a dark terminal, with the
  Webull app open on the other screen, ready to catch us in a lie.
- **The single job of the surface.** Answer *"what am I carrying on this name, and what did it cost
  me net"* in one line — **without ever claiming to know how the legs pair.**

The design consequence of that third clause is the whole feature: **the group is a count and a net.
It is never a shape.**

---

### 2. What a group is, and when one exists

| Condition | Renders as |
|---|---|
| A ticker with **≥ 2 option legs** in the book | ONE collapsed group row/card |
| A ticker with **exactly 1 option leg** | Today's row, **ungrouped, no chevron** |
| Equity/share legs on the same ticker | **Never grouped.** Their own row, unchanged |
| A position with `fidelity: 'unrecognized'` | **Never grouped, never counted** in a group's leg count. Today's bare entry, top level |

A group of one is forbidden: rendering a chevron and the word "netted" over a single leg asserts an
aggregation that did not happen. Grouping must be a **fact about the book**, not a uniform layout
rule.

**Grouping never changes the panel's count line.** `BROKER_COPY.positionsCount` keeps counting
broker positions (`13 positions`), because its shipped rule is *never understate the broker's
book*. It must not become a group count, and it does not gain a `· 5 groups` clause (see §7, the
accessory cut).

---

### 3. Structure before style (DESIGN_RULES §1.2 — no colour or type decisions yet)

**Desktop.** The group header is a row **in the same 4-column grid as its legs**
(`minmax(220px, 1.6fr) minmax(120px, 1fr) minmax(110px, 1fr) auto` — the shipped
`BrokerPositionRow` template), so every column lines up between the group and the legs beneath it.

```
[ v ] NVDA  4 option legs · grouped by underlying     Qty        Net entry            Convexa-modeled
                                                       —        $3,040.00 debit           −$412.00
                                                                netted by Convexa    Convexa-modeled
      │ (1px divider rule, indented)
      │  NVDA  Custom  …                               2        $15.20              −$180.00
      │  NVDA  Custom  …                               2        $30.40              −$232.00
```

Column occupancy at the group level:

| Column | Group header carries |
|---|---|
| 1 — identity | the disclosure **button** (ticker + count + grouping-basis clause + chevron) |
| 2 — Qty | `—` (not applicable at group level; see §5) |
| 3 — Net entry | the netted figure **or** its withheld literal, **plus its basis label** |
| 4 — right rail | the combined **Convexa-modeled** P/L, and the reassessment action slot (§8) |

Expanded: today's `BrokerPositionRow`s render **unchanged** inside a panel with a 1px left rule and
an indent — the shipped `LegDisclosurePanel` grammar, one nesting level up. The panel is **always
rendered** and `hidden` when collapsed, so `aria-controls` never dangles (the exact rot
`legDisclosure.spec.tsx` was written to catch).

**Mobile (`<sm`).** One card per group. The **entire header line is the full-width disclosure
button** at ≥44px (the shipped `variant: 'card'` shape). Net entry + P/L sit in the meta row.
Expanded child `BrokerPositionCard`s nest inside and **drop their own border and outer padding**,
inheriting the group's left rule — nesting must never double the frame, which is the concrete
393px-overflow mechanism here.

**Semantics.** The group header is **not** a heading (no `<h*>`; stat values are not headings —
convexa-design §6). Group + legs are a `ul`/`li`, matching `LegDisclosurePanel`.

---

### 4. The affordance (keyboard-reachable, never hover-only)

A real `<button type="button">` with `aria-expanded` and `aria-controls` — Enter and Space work for
free, and the app's ONE authored `*:focus-visible` ring (theme layer,
`extrasFor(theme).textAmber`) applies without a bespoke per-component ring.

Two rulings that improve on the shipped precedent rather than copying it:

1. **The button's content includes the ticker and the count text**, not a bare chevron. The shipped
   desktop `LegDisclosureButton` renders `⌄` with `aria-hidden` and **no accessible name** — a
   screen-reader user hears an unlabeled button. Here the visible copy *authors* the name:
   `NVDA — 4 option legs, grouped by underlying`, with state carried by `aria-expanded`. The
   chevron stays `aria-hidden`. This also gives a far larger pointer target on desktop.
2. **The chevron is `text.secondary`, never amber.** The disclosure chevron does not earn amber —
   amber is spent, not sprinkled (shipped ruling, `LegDisclosure` ¶`aria`).

**No motion.** Disclosure is instant: no MUI `<Accordion>`, no transition property, no keyframe.
The app has ONE orchestrated motion moment (the staggered widget reveal); a collapse animation
would be a second one, and the shipped leg disclosure already set the precedent of none. Nothing to
gate behind `useReducedMotion` because nothing animates.

**The control never dims and never disables** on either degradation axis. A stale, offline group is
still expandable — the legs underneath are exactly what a degraded reader most needs.

**Expansion state is ephemeral**, React-local, keyed by underlying, default **collapsed**, gone on
reload (the shipped `LegDisclosure` AC-36 rule). It is never persisted — persisting it would drag
`loss-free-durable-migration` into an FE-only presentation feature for no user value. Because the
key is the underlying, state survives a refresh within the session; a ticker that leaves the book
drops its state.

---

### 5. The five not-a-number literals at group level — which, where, and why

The five shipped literals mean five different things and none may be reused for another's meaning
or joined by a sixth (`absent-is-not-none`, and the shipped G2 rule that **`not recorded` appears in
NO broker state** — Convexa holds no record of a broker position at all).

| Slot | Literal | Why this one |
|---|---|---|
| **Qty** on a group header | **`—`** *(not applicable)* | Quantity is a **per-leg** fact. A set of legs on opposite sides has no single quantity; summing 2 long + 2 short into `4` is a fabricated claim and `0` is worse. The fact does not apply at this level — which is exactly what `—` means. Never blank: a blank cell is indistinguishable from an interpolation bug in a screenshot. |
| **Net entry**, any grouped leg's cost basis **never supplied by the feed** | **`not provided`** | The fact the FEED never carried. A refresh will not produce it. |
| **Net entry**, contract size could not be reconstructed for any grouped leg | **`not provided`** | A units fact we do not hold. Explicitly **not** `unavailable`, which would imply "this cycle" (matches the shipped `brokerView` ruling verbatim). |
| **Net entry**, a leg's cost basis was **carried but unparseable**, and no leg is permanently missing one | **`unavailable`** | Genuinely this-cycle: a re-read could fix it. |
| **`no basis`** | **Deliberately unreachable at group level** | It is the *percentage denominator* literal. Broker rows render no `%` today, and the group renders none either — so `no basis` correctly never appears. **If product later adds a group `%`, `no basis` is its literal for a ~$0 net (a zero-cost group is a real shape here), and nothing else is.** |
| **`not recorded`** | **Banned in every broker state** | Shipped G2. Grouping must not reintroduce it via any newly composed string. |

**Precedence inside one group — permanent beats transient.** If one grouped leg's cost was never
supplied and another's was unparseable, the group renders **`not provided`**, not `unavailable`.
The literal describes the *aggregate figure's* status, and that figure can never be computed no
matter how many times the trader refreshes; `unavailable` would sell them a refresh that cannot
work.

**This inverts the shipped per-position precedence** (`brokerView.ts` prefers `unavailable` when
`anyUnparseableBasis`). I am proposing the divergence knowingly, for two reasons: (a) that branch is
**unreachable on today's real feed**, since every Webull position is single-leg, so nothing shipped
depends on it; (b) a group spans positions, which is precisely what makes the mixed case reachable
for the first time.

**Consequence that must be written down or it will be filed as a bug:** a group header can read
`not provided` while one of its own child rows reads `unavailable` in the same column. That is
**correct** — two different subjects with two different statuses — and QA needs it stated.

---

### 6. Copy — the exact strings

#### 6.1 The group identity line

- Ticker: `NVDA` (unchanged weight/size from the shipped row: 0.95rem / 700)
- Count + basis, one line, always visible:
  **`4 option legs · grouped by underlying`** (plural-safe formatter; `1 option leg` is
  unreachable by §2 but the formatter must still be correct)
- Accessible name of the button: **`NVDA — 4 option legs, grouped by underlying`**
- Tooltip on the count clause:
  > **`Webull reports these as separate holdings on one underlying and sends no strike, expiry, or
  > call/put. Grouping them by underlying is a fact; naming the shape would be a guess, so Convexa
  > doesn't.`**

**No structure chip on a group header. Not even `Custom`.** `Custom` is defined in this codebase as
*the residue of an exact match* — it asserts that Convexa looked at a shape and failed to name it.
At group level Convexa never saw a shape and structurally cannot. A `Custom` chip here would be an
unearned claim of having tried. The per-leg rows keep their existing chip untouched when expanded.
This is the single most likely regression in the feature and it is a scannable string.

#### 6.2 Qty

- Value: **`—`**
- Tooltip: **`Quantity is a per-leg fact. A group of legs has no single quantity — expand to see
  each leg's.`**

#### 6.3 Net entry — the honesty framing (`model-read-carries-its-assumptions`)

- Figure: `$3,040.00 debit` / `$1,250.00 credit` — the shipped grammar and formatter. **Debit and
  credit are WORDS, never colour**: green/red is reserved for P/L direction (convexa-design §2).
- Basis label directly beneath the figure, 0.6875rem, mirroring the shipped `broker-pl-label`
  slot so the figure **never renders unlabeled**:
  **`netted by Convexa`**
- Tooltip on the label:
  > **`Convexa added these legs' costs together — Webull doesn't send a combined figure, and it
  > doesn't send an option's contract size either, so Convexa reconstructed that from Webull's own
  > totals. A model read, not a Webull fact.`**
- **And the assumption is made VISIBLE on expand**, in the sentence slot the shipped disclosure
  panel already reserves for exactly this (`leg-max-loss-note`):
  > **`Net entry is Convexa's arithmetic on the legs below, at a reconstructed contract size of
  > ×100 — a size Convexa worked out from Webull's own totals, not one Webull stated. Advisory
  > context, not a broker figure.`**

**The judgement call I am making, stated so R2 can attack it:** collapsed, the visible basis is the
label `netted by Convexa` (who computed it), and the finer ×100 reconstruction is one interaction
away — visible in full on expand, and in the tooltip while collapsed. I hold that a visible
"Convexa did this arithmetic, not Webull" label satisfies the invariant's self-describing
requirement at collapsed density, and that hoisting `×100 reconstructed` into every group header
buys precision the reader cannot act on at the cost of the line the feature exists to produce. If
the council disagrees, the fix is one extra clause in the label, not a structural change.

#### 6.4 Net entry — withheld

- **`not provided`** tooltip (group-scoped; the shipped `notProvidedTip` says "this position",
  which is wrong for a group):
  > **`A net needs every leg's cost. Webull's data doesn't include one for 1 of these 4 legs, and
  > Convexa won't guess it or add up the rest — a partial sum would read like the real number. Each
  > leg's own cost is shown below.`**
- **`unavailable`** tooltip:
  > **`Convexa couldn't read the cost Webull sent for 1 of these 4 legs, so it won't net them this
  > cycle. Refresh for another read — each leg's own cost is shown below.`**
- Visible reason line inside the expanded panel (replacing the §6.3 basis sentence when the figure
  is withheld):
  > **`Net entry needs all 4 legs' costs. 1 is missing from Webull's feed.`**
  > **`Net entry needs all 4 legs' costs. 1 couldn't be read this cycle.`**

All of these **count**, never name. "1 of these 4 legs" is a fact; "the short leg" would be a guess.

#### 6.5 Combined modeled P/L

Reuses the shipped strings verbatim — `Convexa-modeled`, its tip, and the dual label
`modeled now · on your book as of {time}`. Withheld cases use the same two literals under the same
permanent-beats-transient precedence as §5. `no basis` never appears (no `%` is rendered).

#### 6.6 Fidelity notes inside an expanded group

Today each `partial` row names its own omissions. Five grouped legs × two notes = ten near-identical
lines inside one expanded group. **Byte-identical notes across grouped legs render ONCE, at group
level, on expand; a leg whose note text differs keeps its own.** Deduping identical strings loses no
information and is the difference between an honest disclosure and a wall the trader learns to skip.
If the notes turn out to interpolate per-leg detail, this is a no-op and costs nothing.

---

### 7. Token plan + self-critique (DESIGN_RULES §1.3 / §1.4)

#### 7.1 Tokens — four named values, **zero new tokens, zero hex**

1. **`divider`** — the group's 1px left rule and the header's bottom border. *The entire grouping
   idea costs zero colour.*
2. **`text.primary`** — the ticker and the netted figure.
3. **`text.secondary`** — the count, the grouping-basis clause, the `netted by Convexa` label, the
   chevron, and every withheld literal. Explicitly **not `text.disabled`**, which was measured at
   2.54:1 dark / 2.65:1 light in the running app and is below the 4.5:1 floor — the shipped
   `FactText` already carries this correction and must be **reused, not re-authored**.
4. **`success.main` / `error.main`** — the group P/L direction ONLY.

**Type:** no new faces. `typographyTokens.monoFontFamily` + `tabular-nums` for the count and every
figure (numerals are the personality — convexa-design §6); body face for the honesty clause. Sizes:
ticker 0.95rem/700, count 0.8rem mono, basis clause 0.75rem, `netted by Convexa` 0.6875rem = 11px —
exactly at the shipped floor, matching `broker-pl-label`.

**Layout, one sentence:** *the group is a row in the same grid as its legs, with a chevron in the
first column and a single 1px rule threading its legs beneath it — so a spread reads as one object
with parts, not five loose rows.*

**Signature: none new, deliberately.** The Broker tab's signature is already the mono ledger stamp
in `ProvenanceHeader`; the disclosure's signature is already the left rule in `LegDisclosure`. This
feature's design contribution is **grammatical reuse across a nesting level**, not a new visual
idea. The convex arc is set-pinned to exactly three places — **the chevron must not be an arc**; a
fourth use is a violation, not a flourish.

**Mode-awareness:** because nothing here needs a surface colour, dark/light parity is nearly free.
Any mode-aware value that does appear resolves through `extrasFor(theme)` **inside an sx callback**
— bare `extras.` dark-locks the surface (`theme-token-discipline`).

#### 7.2 Self-critique — what I would have produced by default, and what I changed

| The default answer | Revised to | Why |
|---|---|---|
| MUI `<Accordion>` with a smooth collapse | Instant disclosure, no transition | One motion moment; the shipped leg disclosure animates nothing |
| A `SPREAD` / `MULTI-LEG` badge on the group | **Banned** | Names a structure. So does `Custom` here |
| Sum the leg quantities into one Qty | `—` + tooltip | A sum across opposite sides is a fabricated number |
| Tint the netted entry (green credit / red debit) | Untinted; the words `debit`/`credit` | Green/red is P/L direction only |
| Amber chevron so the affordance pops | `text.secondary` | Amber is spent, not sprinkled |
| Put the whole honesty story in a tooltip and keep the row clean | Grouping basis is **visible inline**; only the ×100 detail is one interaction away, and fully visible on expand | Honesty is a design material, styled not hidden |
| Persist expansion in a UI-prefs key so it "remembers" | Ephemeral | Would introduce a durable key and pull `loss-free-durable-migration` into an FE-only feature for no value |
| A raised/zebra background behind group rows | **Cut — this is the §4 accessory removal** | A collapsed group is a peer of an ungrouped row; tinting only some rows bands the table and is the generic-SaaS tell. The left rule, the chevron and the count already carry it |
| An `Expand all` control | Cut | Five groups; a second control for a one-click job. Named here as the obvious place to add it if the owner asks |
| A `13 positions · 5 groups` count line | Cut; the count line is unchanged | The shipped line has one job — never understate the book |

**Slop check (§3):** no cream + serif + terracotta; no near-black + acid accent; the one hairline is
load-bearing structure, not broadsheet decoration; no purple gradient; no GitHub Dark neutrals (all
colour is token-bound); Inter is not the identity.

---

### 8. Degraded states — `live-vs-static-isolation`, stated per datum

The **exact degraded wording is unchanged and reused**. What is new is *which side of the line each
group-level datum sits on*, and that classification is the deliverable:

| Group-level datum | Family | On an SSE drop (market-data axis) | On a stale book (snapshot axis) |
|---|---|---|---|
| Ticker | static / snapshot | unchanged | `STALE_SNAPSHOT_SX` (0.62) |
| Leg count | static / snapshot | unchanged | 0.62 |
| `grouped by underlying` clause | static | unchanged | 0.62 |
| Qty `—` | static | unchanged | 0.62 |
| **Netted entry figure or literal** | **static** | **keeps rendering, undimmed, no `⏸`** | 0.62 |
| `netted by Convexa` label | static | unchanged | 0.62 |
| **Combined modeled P/L** | **live-derived** | **`⏸ ` prefix + opacity 0.5, never blank** | figure keeps updating; label switches to `modeled now · on your book as of {time}` |
| Disclosure button + panel | chrome | never dims, never disables | never dims, never disables |

The punchline: **a stream drop must leave a collapsed group still answering "what did this cost
me."** That static half is the entire reason the netted entry belongs in the collapsed header rather
than behind the disclosure.

Other states, for completeness:

- **Cold skeleton (S9) / first sync (S2):** unchanged generic skeleton rows. A grouping skeleton
  must **never** render a placeholder leg count — a fake `4 option legs` is a claim.
- **Confirmed empty (S4):** unchanged. No groups, no grouping copy.
- **S5 unknown / S8 with no snapshot:** unchanged. No rows, no groups.
- **Nothing groupable** (every ticker has ≤1 option leg): the panel renders exactly today's rows.
  **No "no groups" message** — the absence of grouping is not an event.
- **A refresh that changes the book:** groups must not silently collapse or reshuffle; identity is
  the underlying, so expansion survives.

**Mobile parity, including the shipped divergence.** `BrokerPositionRow` renders `<ModeledPl>` for
`unrecognized` entries; `BrokerPositionCard` does not. I rule the **desktop behaviour correct** —
under `absent-is-not-none`, an omitted slot is the one thing the doctrine forbids, because the
mobile reader cannot tell whether a P/L exists, was withheld, or was lost to a render bug. Mobile
should converge on rendering the withheld literal with its label. This is a pre-existing defect
inside this feature's blast radius; the brief's own feasibility note says a desktop-only grouping
would deepen it, and shipping grouping without closing it deepens it anyway.

---

### 9. Verification-kind guidance (NOT acceptance criteria)

Offered for the PM's `Verify by` column, per the risk-based rule (`qa-verify` §4). `test` =
invariant / negative space / silently-regressing; `review` = visible and intentional.

| Behaviour | Kind | Why |
|---|---|---|
| Literal choice per §5 and the permanent-beats-transient precedence | **test** | Unreachable on the owner's real book; invisible to review; silently regressing |
| No structure chip / no `Custom` on a group header | **test** | Negative space, and a scannable string |
| Netted entry keeps rendering undimmed on a stream drop | **test** | A promoted invariant |
| Combined P/L takes `⏸` + 0.5 and never blanks | **test** | A promoted invariant |
| A ticker with 1 option leg produces no group and no chevron | **test** | Negative space |
| `unrecognized` never enters a group | **test** | Negative space |
| Panel count line still counts positions, not groups | **test** | Silently regressing |
| `aria-expanded` / `aria-controls` resolve to a real panel | **test** | The exact rot `legDisclosure.spec.tsx` exists to catch |
| Mobile and desktop render the same slot set (incl. the `ModeledPl` convergence) | **test** | The shipped divergence proves review missed it once already |
| No horizontal overflow at 393px | **test** | Joins the existing viewport set |
| Exact copy strings, count clause wording, chevron placement, column order | **review** | Visible and intentional |
| Focus ring visible and **single** (see risk 3) | **review** | Visual |
| Dark/light parity | **review** | Both modes, eyes-on |

---

### 10. The unruled `Build reassessment` item (route to owner at R3 — one question)

Grouping changes what a row is, so the ruling should land here. The UX facts: on a broker option
leg `buildBrokerReassessment` produces `position: null` (no strike/expiry/right), so the hand-off is
a request about a contract nobody can identify — and after grouping, five identical buttons would
sit inside one expanded NVDA group.

**The single owner question:** *On broker option legs Convexa cannot identify, should
`Build reassessment` (a) stay per-leg as today, (b) disappear, or (c) move to the group and be one
ticker-level request per name?*

**My recommendation: (c).** One action per group, in the group header's right rail; the per-leg
duplicates disappear inside an expanded group. Five identical buttons imply a per-contract precision
we do not have, and the decision the trader is actually making ("what risk am I carrying on this
name") is a ticker-level question. The button label stays `Build reassessment` (an action's name
stays constant through a flow); the honesty lands in the assembled request's basis line, which
already carries the as-of and would state that no contract detail was available. This is a copy and
placement change only — no write path, `no-real-order-path` untouched. It is a **product** ruling,
not an architect call.

---

## Risks I see

1. **The precedence inversion in §5 will be filed as a bug.** A group reading `not provided` above a
   child row reading `unavailable`, in the same column, looks like an inconsistency to anyone who
   has not read this document. If it is not written into the spec in those words, either QA fails it
   or a later refactor "fixes" it back.
2. **Contrast of dimmed honesty text.** `text.secondary` at 0.62 opacity (the shipped
   `STALE_SNAPSHOT_SX`) may fall under 4.5:1 in one or both modes. The shipped surface already dims
   `FidelityNotes` this way, so this is pre-existing rather than introduced — but grouping puts more
   honesty copy inside that block, and the `FactText`/`text.disabled` episode proves this exact
   class of bug ships. Needs measuring in the running app, both modes.
3. **A doubled focus ring.** `BrokerPositionRow` already draws `&:focus-within { outline: 2px solid
   primary.main }` on its container. A focused disclosure button inside or adjacent to that
   container will render the theme's authored `:focus-visible` amber ring *and* the row's blue
   focus-within outline at once. The group header must not sit inside a container that draws its own
   outline — or one of the two must go.
4. **393px overflow from nested frames.** A bordered, padded child card inside a bordered, padded
   group card doubles the horizontal chrome. The mitigation is in §3 (children drop border and outer
   padding), but it is the single most likely way this feature breaks the no-overflow rule.
5. **"Legs" could stop matching what expansion reveals.** The count says legs; the expansion shows
   rows. Today those are equal because every Webull position is single-leg. If a broker position
   ever carries two option legs, `4 option legs` would expand to three rows and the count becomes a
   quiet lie. The count noun must track what expands, or the copy must change with it.
6. **The structure name will creep back in.** Someone will want a hint. The three entry points are:
   the group chip slot, an "N-leg spread" phrasing in the count line, and the reassessment request's
   `structure` field. All three need to be closed explicitly.
7. **A group with a netted entry and no combined P/L would re-create the arithmetic the feature
   exists to remove** — see the PM assumption below. This is the largest product risk in my lane's
   line of sight.
8. **Grouping increases the reader's trust faster than it increases our knowledge.** A single tidy
   NVDA line with one dollar figure *feels* like the app understands the position. Every honesty
   affordance in §6 exists against that feeling, and cutting any of them for density is the way this
   feature turns into the lie it was designed to avoid.
9. **The `not provided` / `unavailable` group paths will never be seen on the owner's book** (the
   ×100 reconstruction resolves for all nine captured rows). They are verifiable by test only; a
   review-only marking on those cases would mean they are effectively unverified.

---

## Assumptions I'm making about the other two lanes

**Architect**

- The netted entry is produced by running the **existing** `buildPositionView` composition over the
  union of a group's mapped legs — not by summing already-formatted per-position figures. *Falsified
  if* the group net is assembled from rendered strings or from per-position dollar totals, in which
  case the all-or-nothing withholding and the §5 precedence cannot be implemented as written.
- The group-level view exposes, as **two distinct counts**, how many grouped legs had a
  never-supplied cost basis and how many had an unparseable one. *Falsified if* the layer surfaces
  only a single `entry_known` boolean — my §6.4 copy ("1 of these 4 legs") and my literal precedence
  both need the two counts separately.
- The grouping key is the **underlying symbol exactly as the wire supplies it**, with equity legs
  and `unrecognized` entries excluded, and no normalization, aliasing, or fuzzy matching. *Falsified
  if* the key is derived from anything else.
- Expansion state stays **React-local** — no store, no `convexa.*` key, no `ViewConfig` field. So
  `loss-free-durable-migration` is not bitten by this feature. *Falsified if* the architect proposes
  a durable per-group expand preference.
- `BrokerPositionRow` and `BrokerPositionCard` are reused as the group's children **unchanged in
  their internals**; only their *container* changes (border, padding, indent), supplied by the
  parent. *Falsified if* the children need a `nested` prop that alters what they render — at which
  point "today's per-leg rows unchanged" stops being literally true and the brief's own wording is
  in play.
- Empty `apps/api` diff, no wire change, no new endpoint — so there is **no new failure mode to
  write copy for** beyond the shipped five literals and the states in §8. *Falsified if* any wire
  field is added.
- `no basis` genuinely cannot arise in any group slot, because no percentage is rendered at group
  level. *Falsified if* the group view computes a `pl_pct` that reaches a render.

**PM**

- The group renders a **combined modeled P/L**, not a netted entry alone. *Falsified if* the ACs
  scope the group to entry-only — in which case I will raise it as an R2 conflict, because a header
  showing a net cost beside an empty P/L slot is exactly the mental-arithmetic shape the brief's
  decision-impact paragraph sets out to kill, and there is no honest literal for "we chose not to
  compute this" (inventing one would be the sixth literal the brief forbids).
- **No AC requires a structure name, a confidence measure, a leg-pairing hint, or a `Custom` chip at
  group level**, and at least one AC pins the **absence** of a structure chip on a group header.
  *Falsified by* any AC phrased in terms of "the spread", "the vertical", or "the shape".
- Grouping applies only at **≥2 option legs on a ticker**; a lone option leg is not a group.
  *Falsified if* an AC requires a group-of-one for layout consistency.
- The panel's `13 positions` count line is **unchanged in meaning and wording**. *Falsified by* any
  AC that makes it count groups or rows.
- `unrecognized` entries are **out of grouping scope**, and the mobile `ModeledPl` divergence repair
  is **in scope**. *Falsified if* the PM rules the repair out of scope — in which case mobile keeps
  a state desktop does not have, and grouping ships on top of a known parity defect.
- The `Build reassessment` ruling is routed as **one owner question at R3**, and whatever the answer,
  it resolves to a copy/placement change with **no new write path**. *Falsified if* any option under
  consideration adds an Accept, a store write, or an order path.
- The withheld-net-entry cases are accepted as **test-verified, not owner-observable**, because the
  ×100 reconstruction resolves on every row of the owner's real book. *Falsified if* the ACs expect
  those states to be demonstrated in a live verify.
