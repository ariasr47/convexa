# R3 — ux reconcile: positions-legs

> Scope of this round, exactly: (1) resolve the architect's conflict against my U2; (2) design the
> two states both siblings say are mine — `store-faulted` and the `position_eval` primary-leg
> approximation. Everything here is component states + copy. No schema, no math.
>
> **Deferred to owner, not re-argued here:** payoff math in/out (and therefore every withheld-reason
> string that depends on it), and the call/put tint divergence. Also deferred: Group-by-Expiry
> restoration, the merge-notice durability question, and PM's strict-vs-lenient faulted-write call
> (§2.9 names the one string that changes under each answer so R4 is not blocked either way).

---

## 1. Conflict — "so no *migrated* row ever renders `Custom`" — **CONVERGED**

### 1.1 I accept both corrections

The mechanism correction is accepted without reservation: the migration lifts a legacy record to a
leg and the recognizer derives the kind **from the leg**; the old `Strategy` value is not carried
forward. My R1 assumption 7 described a Strategy→StructureKind map that does not and should not
exist, and I withdraw it.

The substantive correction is accepted too, and for the reason the architect gives rather than as a
concession: **the lift must not fabricate a `right` or a strike to make a row name nicely.** An
invented instrument fact in an audit spine is worse than a neutral chip, and it would travel into the
archive import through the shared lift. A `Custom` chip on a malformed legacy record is the migration
behaving correctly.

### 1.2 U2, restated (this replaces the R1 U2 text verbatim)

> **U2** — A **well-formed** migrated single-leg option position renders exactly as shipped
> (`TSLA` · `$400 Call`, chip `Long call` / `Long put` / `Short call` / `Short put`), and its P/L
> figure is identical before and after the migration. A migrated record that is **missing a contract
> fact** renders `Custom` plus the §1.3 cell treatment — a legitimate outcome, not a defect.
> **Verify by: `review`** (visible, intentional copy + presence).

### 1.3 What I owe in return: `Custom` alone is NOT enough copy

Here is where I hold something. The architect's proposal says "UX already owns copy that makes this
harmless, since Custom is neutral by design." Neutral is exactly the problem. If a record with a
missing `right` renders a neutral `Custom` chip and its `right` cell renders `—`, then the app has
told the trader *"not applicable"* about a fact that **is** applicable and simply was never recorded.
That is a U8 violation created by the migration — two different truths sharing one glyph — and it is
strictly worse than the `Custom` chip it hides behind.

So the resolution is: **the chip stays neutral, and the CELLS carry the truth.** A third literal
enters the surface, and U8 becomes a three-way rule.

| Meaning | Renders | testid | Tooltip |
|---|---|---|---|
| Not applicable — the instrument has no such field | `—`, `text.disabled` | *(none, as shipped)* | *"Not applicable — this position holds shares, which have no strike or expiry."* / *"Multiple legs — expand the position to see each strike."* |
| Unavailable this cycle — the lookup failed and may succeed next cycle | `unavailable`, `text.disabled` | `cell-unavailable` | existing `ROW_UNAVAILABLE_TIP` |
| **Not recorded — the saved record never held this fact** | **`not recorded`**, `text.disabled` | **`cell-not-recorded`** | **`NOT_RECORDED_TIP`** (below) |

Treatment is identical to the shipped `unavailable` literal — MUI `variant="body2"`,
`color: 'text.disabled'`, wrapped in the same `Tooltip arrow`. The three differ **by text and testid
only**, which is precisely why each needs its own testid: this is the distinction I flagged in R1
risk 4 as the one most likely to regress quietly, and it now has three members instead of two.

**Exact copy — new constants in `labels.ts`:**

```
NOT_RECORDED_TIP =
  "This position was saved before Convexa recorded this detail, or the saved record is damaged.
   Convexa won't guess it. Nothing was deleted — the record is intact and still counted in your
   history."
```

```
UNPRICEABLE_RECORD_TIP =
  "Convexa can't price this position: its saved record is missing contract details it needs.
   That won't change on the next update. Nothing was deleted, and your other positions are
   unaffected."
```

`UNPRICEABLE_RECORD_TIP` exists because the shipped `ROW_UNAVAILABLE_TIP` promises transience
("couldn't be priced **this cycle**"). A record that never held a strike will never price, and
repeating a this-cycle promise every cycle forever is the app lying quietly. The **word** in the
`pl` / `pl_pct` / `mark` cells stays `unavailable` (it is unavailable, and U9's all-or-nothing rule
is unchanged); only the tip differs.

**Row anatomy for such a record, complete:**

- structure chip: `Custom` (neutral, unchanged, no color)
- structure line: `TSLA` · `1 leg`
- `strike` / `right` / `expiry` / `dte`: `not recorded` for each fact actually absent; `—` for any
  field genuinely not applicable
- `qty`: the recorded qty, or `not recorded` if absent/zero
- `pl`, `pl_pct`, `mark`: `unavailable` with `UNPRICEABLE_RECORD_TIP`
- excluded from the group subtotal, counted in the shipped `· N positions excluded (unavailable)`
- **still listed, still closable, never hidden, never pruned** — it is a real row in the book

At 393px: `not recorded` is 12 characters against `unavailable`'s 11 in the same nowrap cell, and on
the card these facts live in the structure line and the expansion, not the four-item footer. No new
overflow surface.

### 1.4 Dependency I am naming, not assuming

This design needs the component to tell "absent fact" from "not applicable" **without inferring it
from a null**. It does *not* need a new field **if** the lift sets `instrument_kind: 'option'`
honestly on every legacy record (both source stores were option-only, so that is a fact, not a
guess) and leaves `strike` / `right` / `expiration` null rather than fabricating them. Then:

- `instrument_kind === 'option'` + null strike ⇒ **`not recorded`**
- `instrument_kind === 'equity'` + null strike ⇒ **`—`**

**If** the lift can emit a leg whose `instrument_kind` is itself unknown, that is a fourth meaning
and I need to know — it would need its own word, and I would rather write it now than have it land
on `—` at GATE Q. Architect's call; I am asking, not assuming.

---

## 2. State design 1 — `store-faulted` (the writes-refused mode)

**This is the most dangerous state in the feature and it is the one I most want built to the letter.**
It is a fifth top-level component state: `default` · `loading` · `offline` · `unavailable(row)` ·
**`store-faulted`**. It is not a variant of any of the other four.

### 2.1 The governing rule for the state, in one line

**Nothing on this surface may accept an input it will not keep.** Every affordance whose only purpose
is to write is *visibly and reachably* refused *before* the trader spends effort on it — never
enabled-then-failed, never a toast after the dialog closes.

### 2.2 What faulted must NOT look like

- **It must not look like offline.** Offline dims the live block and freezes numbers; faulted touches
  neither. **In faulted mode nothing dims, no `⏸` appears, and no number changes.** A stale value is
  never presented as live and a live value is never presented as stale — the live feed is fine here;
  it is the *store* that is hurt. The two states can co-occur and must remain independently legible.
- **It must not use green or red.** Reserved for P/L direction. Faulted is warning-class: burnt
  orange **with an icon**, per canon (hue alone never carries "warning").
- **It must not use `error`-class red framing on the rows.** The rows that loaded are correct.

### 2.3 Where the banner lives, and the banner-collision rule I now resolve

One banner region, directly above the table, inside `CustomizationToolbar`'s existing banner slot
(where `offline-banner` renders today). Fixed priority order, top to bottom:

1. **`store-faulted`** — non-dismissible (new)
2. **live-offline** — non-dismissible (`⚠ Live marks paused — P/L shown is from the last update.
   Records persist.`, shipped, unchanged)
3. **at most ONE dismissible notice** — merge notice first if pending, otherwise the stale-saved-view
   notice; the second appears only after the first is dismissed.

**While faulted, no dismissible notice renders at all.** Two reasons, both substantive: a dismissal
cannot be persisted in a store that refuses writes, so the notice would return on every load forever;
and the merge notice would be a *false claim* — the promote was aborted, so no merge happened. This
answers my own R2 ask about the shared banner slot; it is mine to settle and it is settled.

This state deliberately spends vertical space and can push the first row below the fold at 393px.
That is the correct trade exactly once: a trader who does not read this banner will lose a trade.

### 2.4 The banner — exact copy

Rendered as a `role="status"` region (not `alert` — it is a standing condition, not an interruption),
with a warning icon, non-dismissible, `id="store-faulted-banner"`.

**Heading line (bold):**

```
⚠ Recording paused — Convexa couldn't read your saved data
```

**Body:**

```
Rather than overwrite it, Convexa left it exactly as it is. Nothing was deleted. The positions
below are the ones that loaded and their numbers are correct; anything in the part it couldn't
read isn't shown. Opening, closing and cancelling positions will not be saved while this lasts.
```

**Action line** (two controls, both real, ≥44px targets, authored `:focus-visible` rings):

```
Export an archive of what loaded   ·   Reload the page
```

- *"Export an archive of what loaded"* is a link that moves focus to the existing Archive block
  further down `/positions` (`data-testid="tr-archive"`). It does **not** duplicate the export
  button, and it does **not** rename the shipped `Export archive` action — an action's name never
  changes per case (DESIGN_RULES §6).
- *"Reload the page"* is a button. It is the only in-app step that can actually clear a transient
  read failure, and offering it is honest; offering a "Repair" or "Reset" button would not be,
  because the store never repairs and never deletes.

**Closing line (`text.secondary`, 0.78rem):**

```
If it comes back after a reload, the saved data in this browser needs attention. Convexa will keep
it untouched either way.
```

No apology, no "oops", no "something went wrong", no error code. What happened, what was protected,
what is refused, what to do.

### 2.5 The refused controls — treatment and copy

Affected: the `+ Open simulated position` CTA · every row's `Close` · every pending order's `Cancel`
· the saved-view `Save`, `Save as` and `Delete` controls. (Not affected, all still fully usable:
sort, group, filter, density, layout, switching between existing saved views, expanding legs, the
Track record read, and Export archive.)

**Treatment — and this part is not a detail:** these controls render `aria-disabled="true"` and stay
**focusable**, with activation a no-op. They are **not** given the HTML `disabled` attribute. A
`disabled` MUI button drops out of the tab order and swallows pointer events, so its tooltip never
opens — the reason for the refusal becomes unreachable by both keyboard and hover, which is the
failure this whole state exists to prevent. Each control also carries
`aria-describedby="store-faulted-banner"`. Visually they take the standard disabled treatment
(reduced opacity, no hover elevation) so the refusal is visible before it is read.

**Tooltip on every one of them (`WRITE_REFUSED_TIP`), exact:**

```
Paused — Convexa couldn't read your saved data and won't save anything new until that's sorted.
Your existing positions are untouched.
```

**The entry dialog does not open** in this state. There is no half-filled form that cannot confirm.
The refusal happens at the door.

### 2.6 The other doors — this state is NOT only on `/positions`

`/positions` is not the only place a position can be opened. The Ticker page's trade panel opens the
same shared `TradeEntryDialog` against the same store. **A banner that lives only on `/positions`
ships the exact silent loss it was written to prevent** — the trader opens from `/ticker/TSLA`,
sees a row, reloads, and it is gone.

So: the **refused-control treatment travels with the control**, wherever it renders. On the Ticker
page the entry CTA takes the same `aria-disabled` + `WRITE_REFUSED_TIP` treatment, and a one-line
notice sits above it:

```
⚠ Recording paused — Convexa couldn't read your saved data, so new positions won't be saved.
Open Positions to export an archive of what loaded.
```

("Open Positions" is a link to `/positions`.)

### 2.7 Faulted + empty

If nothing parsed, the table has zero rows. The shipped `EMPTY_NO_POSITIONS` — *"No simulated
positions yet. Open one to start your book."* — would then be **two lies in one sentence**: "yet"
asserts the trader has no history, and "Open one" invites an action that is refused. A faulted-empty
variant is mandatory.

```
EMPTY_FAULTED =
  "Convexa couldn't read your saved positions, so none are shown here. Nothing was deleted —
   your records are still in this browser, exactly as they were."
```

No CTA, no "get started" framing, no illustration. The banner above it already carries the two
actions that exist.

### 2.8 The archive is partial in this state, and must say so

A trader who exports during a faulted session gets an archive containing only what parsed, and may
reasonably believe they now hold a full backup. The Archive block's lead gains a faulted-state line
(`text.secondary`, above the buttons), and the post-export snack appends the same sentence:

```
TR_ARCHIVE_PARTIAL_NOTE =
  "Some saved data in this browser couldn't be read, so this archive holds only the records that
   loaded. It is not a complete backup."
```

The button label stays `Export archive` and the block stays non-destructive.

### 2.9 The one string that changes under PM's owner call

PM routes to the owner whether *all* durable writes are refused, or whether new positions may be
accepted into a fresh store while the unreadable blob is left alone. **Deferred to owner.** Both
siblings lean strict; the copy above is written for strict. If the owner picks lenient, exactly one
sentence changes and nothing else in this state does:

- strict (as written): `Opening, closing and cancelling positions will not be saved while this lasts.`
- lenient: `New positions you open from here will be saved. Positions from the part Convexa couldn't
  read aren't shown, and closing or cancelling them isn't possible until it can read them.`

Under lenient, the entry CTA is **not** refused; `Close` and `Cancel` on rows that did load remain
refused (they would write into the same blob), and `WRITE_REFUSED_TIP` narrows to those.

---

## 3. State design 2 — the `position_eval` primary-leg approximation

The approximation is fine. Shipping it undisclosed is not. Three states, three strings, and the
single-leg case must remain byte-identical to shipped.

### 3.1 State A — single option leg (today's case): **unchanged**

The shipped alert text stands exactly as it is:

```
Your position context changed — consider reassessing.
```

No qualifier, no extra line, no new chrome. A qualifier here would be noise and would change a
shipped surface for no gain.

### 3.2 State B — multi-leg with an evaluable option leg: **the read names its subject**

The alert message is unchanged; a qualifier line rides beneath it in `text.secondary` at 0.78rem
(above the 11px floor), same block, no icon, no color.

```
POSITION_EVAL_LEG_QUALIFIER(legLabel, legCount) =
  `Read on the ${legLabel} — one leg of your ${legCount}-leg position. Convexa evaluates one leg,
   not the whole structure.`
```

Rendered example:

```
Your position context changed — consider reassessing.
Read on the $400 Jul 18 call — one leg of your 4-leg position. Convexa evaluates one leg, not the
whole structure.
```

The same qualifier line accompanies **every** surface that consumes `position_eval` for a multi-leg
position — the alert, the reassessment hand-off preview, and any assessment readout. It is a property
of the read, not of one component. If a fourth surface consumes it later, it inherits the line.

Glossary entry so the qualifier can stay short:

```
POSITION_EVAL_TIP =
  "Convexa's position-context read looks at ONE option leg of your position — the largest long
   option leg. On a spread or a condor that's a read on part of the position, not the whole thing:
   offsetting legs and the structure's net exposure aren't in it."
```

At 393px the qualifier wraps to three lines of prose. Prose wrapping is not overflow; nothing here is
`nowrap`.

### 3.3 State C — no evaluable leg: **an explicit stated non-evaluation, never silence**

A shares-only position today produces *no* alert, and a silent absence is indistinguishable from
"nothing changed" — the exact failure mode this app is built against. The slot is never empty.

```
POSITION_EVAL_NONE_EQUITY =
  "No position-context read — this position holds shares, and Convexa's position reads are built
   on option contracts (strike, expiry, gamma). Silence here doesn't mean nothing changed."
```

Rendering: `text.secondary`, no icon, **no warning color, no error color, not dimmed** — this is not
a degraded state, it is a stated limit. It renders persistently in the slot the alert would occupy,
not as a dismissible alert (there is no event to dismiss).

### 3.4 The gap in the primary-leg rule, and the copy it forces

The architect's rule selects *"the **long** option leg with the largest `|qty × multiplier|` … none
if the structure has no option leg."* Those two clauses do not cover the same set. **A short put, a
short call, or any short-only structure HAS an option leg but has no LONG option leg.** Under the
literal rule it selects none — so it falls to State C, whose copy would then say *"this position
holds shares"*, which is false, or say nothing, which is the silence I am refusing.

I am not resolving this (it is a selection rule, not copy). I am naming it and pre-writing the string
so it cannot ship as silence either way:

- **If** the architect extends the rule to short legs, State C is only ever reached by a
  genuinely option-free position and `POSITION_EVAL_NONE_EQUITY` is the only string needed.
- **If** the rule stays long-only, a third string is required:

```
POSITION_EVAL_NONE_SHORT =
  "No position-context read — Convexa's read is built on a long option leg, and this position
   doesn't have one. Silence here doesn't mean nothing changed."
```

### 3.5 Dependencies I am naming, not assuming

1. **`PositionView` must expose a pre-formatted `primary_leg_label`** (e.g. `$400 Jul 18 call`) plus
   the leg count — not just an internal leg selection. Which leg won must be *readable from the
   projection*. This is the same shape as the architect's own ask about the structure line: if
   presentational components may not format legs, the projection authors the string. Without it,
   §3.2 is uninstantiable and the qualifier degrades to "one of your legs", which names nothing and
   is worse than no qualifier.
2. **`PositionView` must expose which of the three states applies** — evaluable / no-long-leg /
   no-option-leg — as an explicit value, not as `primary_leg_label === null`. A single null cannot
   distinguish §3.3 from §3.4, and choosing the wrong one of those two strings prints a false
   sentence about the trader's own position.
3. The Ticker-page alert list must actually **render** (`useGhostTrade` returns `alerts`; no
   component currently consumes it). If that stays unrendered after the merge, §3.1–§3.4 are copy
   for a surface that does not exist and PM should know at GATE C, not GATE Q.

---

## 4. Acceptance criteria added by this round

These append to R1's U1–U20 (with U2 replaced per §1.2 and U8 extended per §1.3). `Verify by` per
the risk-based rule (`qa-verify` §4): `test` for invariants, negative space and behaviour that
regresses invisibly; `review` for visible, intentional copy/presence/ordering. No named test is
demanded for any of them.

| # | Acceptance criterion | Component state(s) | Verify by |
|---|---|---|---|
| U2′ | A **well-formed** migrated single-leg option position renders exactly as shipped and its P/L is unchanged; a migrated record missing a contract fact renders `Custom` + §1.3 cells and is not treated as a defect | default, migrated | `review` |
| U8′ | `—` (not applicable), `unavailable` (failed this cycle) and `not recorded` (never held) are three distinct literals with three distinct testids, never rendered for each other's meaning | default, error(row), migrated | `test` |
| U21 | A record that can never be priced renders `unavailable` with `UNPRICEABLE_RECORD_TIP`, not the this-cycle tip; it is excluded from the subtotal and counted in `· N positions excluded (unavailable)` | error(row) | `review` |
| U22 | While the store is faulted, **no durable write occurs from any surface** — attempting to open, close, cancel or save a view leaves browser storage byte-identical, and the unreadable blob is never overwritten | store-faulted | `test` |
| U23 | The faulted banner renders above the table, is non-dismissible, carries a warning icon, and reads §2.4 verbatim; its two actions are present and operable | store-faulted | `review` |
| U24 | Every mutating control renders `aria-disabled="true"`, **remains focusable and tooltip-reachable**, is described by the banner, and does nothing when activated; the entry dialog never opens | store-faulted, focus | `test` |
| U25 | Faulted and offline are independent: faulted dims nothing and shows no `⏸`; offline disables no control; when both apply, both banners render in the §2.3 order | store-faulted, offline | `test` |
| U26 | While faulted, **no dismissible notice renders** — not the merge notice, not the stale-saved-view notice | store-faulted | `test` |
| U27 | Faulted with zero rows renders `EMPTY_FAULTED`; `EMPTY_NO_POSITIONS` is never shown in this state | store-faulted, empty | `review` |
| U28 | While faulted, the Archive block and the export snack both carry `TR_ARCHIVE_PARTIAL_NOTE`; the `Export archive` label is unchanged and export still works | store-faulted | `review` |
| U29 | The entry CTA on the **Ticker** page carries the same refused treatment and the §2.6 notice while faulted — the state is not scoped to `/positions` | store-faulted | `test` |
| U30 | A multi-leg position's position-context read carries the §3.2 qualifier naming the leg and the leg count; a single-leg position's read is byte-identical to shipped | default, multi-leg | `review` |
| U31 | A position with no evaluable leg renders the §3.3 (or §3.4) stated non-evaluation — **the slot is never empty and the absence is never silent** | default, equity | `test` |
| U32 | At 393px, the faulted banner, the qualifier line and `not recorded` cells all render with `scrollWidth ≤ innerWidth` in both color schemes | store-faulted, mobile | `test` |

---

## 5. Summary for R4

- **Conflict against U2: CONVERGED.** U2 is replaced by §1.2. The migration derives from the leg, not
  the old enum; `Custom` on a malformed migrated record is correct behaviour. The price of my
  agreement is §1.3 — a third literal, `not recorded`, so the migration cannot silently convert
  "never recorded" into "not applicable".
- **`store-faulted` is designed in §2**, copy-complete, including the banner, the refused-control
  treatment and its accessibility mechanism, the empty variant, the partial-archive note, the
  banner-priority rule, and the Ticker-page door. One sentence is owner-gated and both versions are
  written.
- **The `position_eval` approximation is disclosed in §3**, three states, three strings, with the
  long-only selection gap flagged and its string pre-written.
- **Open dependencies on the architect** (§1.4, §3.5): honest `instrument_kind` on lifted legs; a
  `faulted` flag on the view layer rather than a per-call `false`; `primary_leg_label` on the
  projection; and an explicit tri-state for the eval subject rather than a single null.
