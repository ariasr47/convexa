# GATE Z — amendments bounced to the R4 synthesizer

Raised by: `spire-tech-planner` at GATE PLAN, 2026-08-13. Both items are contradictions between
`SPEC.md` and the tree that a build lane **cannot** resolve in its own lane — the planner correctly
stopped instead of planning around them. Everything else in `PLAN.md` (B1–B16 · F1–F14 · V1–V15) is
unblocked; these two are parked as `F-BZ1` / `F-BZ2`.

---

## Z1 — AC-7 (ship-blocking) contradicts shipped behaviour on `main`

**The finding.** AC-7 requires that nothing untraced seeds a price field, while also treating the
existing entry flow as unchanged. On `main` today, `prefill.ts:53-54` seeds `exit_plan.stop` and
`exit_plan.target` into `TradeEntryDialogView.tsx:221-222` (`setStop(prefill?.stop ?? '')`)
**unconditionally**. So "nothing untraced seeds a price field" is **false on `main`**, and it cannot
hold simultaneously with "the entry flow is unchanged." The planner named two opposite ship-blocking
readings — gate the seeding on `traced` (A), or pin current behaviour (B) — and correctly refused to
pick.

**Conductor ruling: Reading A. The council already settled this; the SPEC's "unchanged" clause is the
defect, not the rule.** `council/decisions.md` D3 states it unconditionally and it is the one rule PM
and UX held together through the entire render disagreement:

> nothing untraced ever seeds, pre-fills, defaults, or is arithmetically derived into any quantity,
> price or limit anywhere, **including the simulated entry dialog**

That clause was written with this exact surface in mind. Gating the seed is also the *safe* direction:
the failure it prevents is a fabricated stop arriving pre-filled in a trade ticket, which is the
precise harm this whole feature exists to stop — and it is the one place in the app where an untraced
number stops being a display and starts being an input.

**What the SPEC must say instead.** Amend AC-7 so it is buildable and honest:
- The prefill of `stop` / `target` is **gated on the field's grounding state**: an `untraced` or
  `not_checkable` figure does **not** seed the entry dialog's price fields; a `traced` figure seeds as
  it does today.
- A field that is **not** seeded comes up **empty**, and the dialog says why in one line, drawn from
  the closed literal set — it must not silently blank, which would read as a bug rather than a refusal.
- State plainly, as a **behaviour change to a shipped surface**, that this differs from `main` — do
  not let it ride as "unchanged." It needs its own AC row with a `Verify by`, and it belongs in the
  frontend track.
- `no-real-order-path` is untouched: this is the simulated dialog and stays simulated.

**Owner-visible consequence, and it is not hidden:** clicking *Act* on a recommendation whose stop did
not trace will bring the stop field up **empty** instead of pre-filled. That is a real change to daily
use. It is the conductor's call under default-with-veto rather than a blocking question, because the
council settled the rule and this is the safer direction — say the word and it flips to B.

---

## Z2 — AC-32 and AC-36's export clause name an artifact that does not exist

**The finding.** Both criteria reference an export surface carrying the strategy and the system prompt.
The only export surface is `GET /api/recommendation/export/{ticker}`, which carries **no `strategy`**
and **no system prompt** (`persona_prompt` is assembled at `recommendation.rs:332-339`).
`INTERFACE_CONTRACT.md` §4 itself pins that endpoint as *"unchanged… Nothing is added here."* The FE
`HandoffDialog` that once showed the hand-off was **deleted at `convexa-redesign` GATE V**. So the
clause is unverifiable as written — it asks a lane to observe something no surface emits.

**Conductor ruling: correct the criteria, do not widen the export.** Widening the export to carry the
strategy and prompt would be a new egress surface — which drags in `egress-copy-tracks-payload` (the
watch-list key from `tradeable-rec-inputs`: a feature widening what leaves the machine must amend every
shipped egress claim in the same feature) — for no stated product need. That is scope this feature
never asked for.

**What the SPEC must say instead.**
- Drop the export clause from AC-32 and AC-36. State the remaining, verifiable requirement.
- **Keep AC-36's two ship-blocking halves, which are already planned as B5 and are independently
  observable:** the single-dollar-amount directive is present in the **assembled prompt**, and deleting
  that directive **reds the build**.
- If any part of the intent genuinely needs an export-visible check, record it as an explicit named gap
  in §9 alongside items 5 and 6 — never as a criterion no surface can satisfy.

---

## Route

Back to the R4 synthesizer (it owns `SPEC.md`), amending **only** these two criteria and the §9 gap
list. Everything else in `SPEC.md` / `INTERFACE_CONTRACT.md` is **locked and owner-approved** and must
not be reopened — in particular the conformance block, the closed vocabularies, the nine structural
guards, and D1–D7. `PLAN.md` then unparks `F-BZ1` / `F-BZ2`.
