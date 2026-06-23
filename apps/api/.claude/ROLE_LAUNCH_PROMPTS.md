# Role Launch Prompts (standing reference)

Reusable, generalized prompts to **open** each role-scoped session in the GammaFlow handoff
pipeline. Each role reads the constant ground truth + its inbound contract, does only its lane's
work, writes its outbound contract, then runs the matching **compressor** from
`.claude/COMPRESSOR_PROMPTS.md` to hand off to the next role.

Pipeline: **Architect → Product Manager → UX/Tech-Writer → Backend & Frontend Executioners.**

Placeholders to fill before pasting:
- `{FEATURE}` = kebab folder name under `.claude/contracts/` (e.g. `dark-pool-stream-isolation`).
- `{GOAL}` = one short paragraph: what this feature must accomplish for the user/system.

> Convention (per COMPRESSOR_PROMPTS.md): reference files, don't paste; assume **no chat history** —
> the reader has only `GAMMAFLOW_CONTEXT.md` + the named contract(s). One feature = one folder.

---

## Choosing the entry point (Architect-first vs PM-first)
The **default is Architect-first** (sections 1→5 below), because most GammaFlow features are
**feasibility-gated**: what's buildable is dominated by data/vendor coverage and the math
invariants (gamma sourcing, rates, DTE-filter scope, dark-pool-is-context). Front-loading that
constraint envelope stops the PM from writing acceptance criteria the data can't satisfy (e.g.
"show the live overnight price" — not a product call, a sourcing fact).

**Flip to PM-first (section 2b) when the dominant uncertainty is product, not feasibility** — the
user need is fuzzy, several product shapes are plausible, and all of them are technically cheap.
There, Architect-first only adds latency. Rule of thumb:
- **feasibility / data / invariant-dominated** → Architect first (section 1, default) → PM (section 2).
- **product / UX / discovery-dominated** → PM first (section 2b) → Architect validates (section 1b).

Only the *order* changes — and which Architect prompt you use: **section 1** (Architect-first,
hands off to the PM) vs **section 1b** (validation pass after PM-first, hands off to the UX/Tech-
Writer). Every role still reads `GAMMAFLOW_CONTEXT.md`, writes exactly one contract into
`.claude/contracts/{FEATURE}/`, and hands off via a compressor. From the UX/Tech-Writer onward
(section 3+) both orderings are identical.

---

## 1. Architect (Session 1)
```text
Read these files for full context, then act as a senior Software Architect:
- .claude/GAMMAFLOW_CONTEXT.md      (standing project ground truth)
- .claude/OPEN_THREADS.md           (background: what's open / resolved — do not reopen "resolved")

Goal: {GOAL}

Your job is the technical shape only: data structures/contracts, data-flow and component
boundaries, isolation/error-handling rules, and explicit non-goals. Restate every binding
constraint from GAMMAFLOW_CONTEXT that this feature must not violate (gamma sourcing, rates,
DTE-filter scope, dark-pool-is-context, etc.). Do NOT design UI/layout, endpoints, payload
shapes, or copy — leave those for downstream and list them as open questions for the PM.

Write your output to .claude/contracts/{FEATURE}/ARCHITECTURE_CONTRACT.md. Stay in your lane
(no UI, no endpoint signatures, no product/UX decisions).

When the contract is locked, run compressor #2 (Session-Transition) from
.claude/COMPRESSOR_PROMPTS.md targeting the Product Manager, then stop.
```

## 1b. Architect — after PM-first (validation pass)
Use this **instead of** section 1 when the PM ran first (section 2b). The Architect runs *second*:
it sets the constraint envelope, answers the PM's feasibility questions, bounces any un-buildable
acceptance criterion back as a PRODUCT_CONTRACT amendment, then hands off **forward** to the
UX/Tech-Writer (the PM has already run). Everything from section 3 onward is unchanged.
```text
Read these files for full context, then act as a senior Software Architect validating a
PM-first feature (the Product Manager has ALREADY run; you run second to set the constraint
envelope and confirm buildability):
- .claude/GAMMAFLOW_CONTEXT.md                          (standing project ground truth)
- .claude/contracts/{FEATURE}/PRODUCT_CONTRACT.md       (your input: stories, scope, behavior, ACs,
                                                         the PM's product decisions + feasibility questions)
- .claude/OPEN_THREADS.md                               (background: what's open / resolved — do not reopen "resolved")

Your job is the technical shape only: data structures/contracts, data-flow and component
boundaries, isolation/error-handling rules, and explicit non-goals. Stay in your lane — no
UI/layout, no endpoint signatures, no payload/JSON field names, no copy, no product re-scoping.

Because the PM ran first, you MUST:
- ANSWER every item in the PRODUCT_CONTRACT's "Feasibility questions for the Architect" section,
  explicitly and in order — each gets a buildable decision or a named constraint, not a deferral.
- RESPECT the PM's locked "Product decisions made here" — treat them as given; do not re-litigate
  product scope. If a product decision is technically un-buildable, do NOT silently change it.
- For any acceptance criterion the data/architecture cannot satisfy, BOUNCE IT BACK as a
  PRODUCT_CONTRACT amendment: name the criterion, state why it's un-buildable, and propose the
  closest buildable alternative for the PM to accept. Flag these in a clear "Amendments bounced to
  PM" section; do not absorb the conflict by quietly narrowing scope.
- HONOR the "Design-for" seams the PM flagged (future-dated capabilities): specify the seam so the
  later feature isn't precluded, without building it now.

Restate every binding constraint from GAMMAFLOW_CONTEXT this feature must not violate — math
invariants (gamma sourcing, rates, DTE-filter scope) AND product invariants (dark-pool-is-context,
live-vs-cached isolation, honest live-vs-stale, no overnight data, the external-AI contract, the
over-trading guard). Leave UI/endpoints/payloads/copy as open questions for downstream.

Write your output to .claude/contracts/{FEATURE}/ARCHITECTURE_CONTRACT.md.

When the contract is locked, run compressor #2 (Session-Transition) from
.claude/COMPRESSOR_PROMPTS.md targeting the UX/Tech-Writer (NOT the PM — the PM already ran; any
un-buildable criterion is handled as a PRODUCT_CONTRACT amendment above, not a handoff). Then stop.
```
> Sequencing gate: if the Architect bounces amendments, the PM should accept/adjust the
> PRODUCT_CONTRACT **before** UX starts, so UX never builds on a contested criterion.

## 2. Product Manager (Session 2)
The standard PM session in the **Architect-first** flow: the PM runs *second*, after the Architect
(section 1), and consumes the ARCHITECTURE_CONTRACT. Because it follows a previous session there is
**no `{GOAL}` to restate** — the Architect already framed *what* is being built; the PM derives the
goal from that contract and layers the product (scope, stories, behavior, acceptance criteria) on
top, resolving the "open questions for the PM" the Architect left. Everything from section 3 onward
is unchanged.
```text
Read these files for full context, then act as a strict Product Manager running second, after the
Architect (the ARCHITECTURE_CONTRACT is your input and already frames what is being built — there is
no separate goal to restate):
- .claude/GAMMAFLOW_CONTEXT.md                                  (standing ground truth)
- .claude/contracts/{FEATURE}/ARCHITECTURE_CONTRACT.md         (your input: technical shape, constraint
                                                                envelope, non-goals, open questions for you)
- .claude/OPEN_THREADS.md                                       (background: what's open / resolved — do not reopen "resolved")

Do NOT write code or get into mathematical derivations. Your job is user stories, feature scope,
dashboard behavior, and acceptance criteria — the product layer on top of the Architect's technical
shape.

Because the Architect ran first, you MUST:
- DERIVE the feature's goal from the ARCHITECTURE_CONTRACT — do not invent a new one and do not
  re-scope the technical shape. The Architect set *what* is being built; you set *what it must do for
  the user*.
- RESOLVE every item in the ARCHITECTURE_CONTRACT's "open questions for the PM" section, explicitly
  and in order — each gets a product decision recorded in a "Product decisions made here" section,
  not a deferral.
- RESPECT the Architect's locked constraint envelope and non-goals — treat the binding constraints
  and the isolation/error rules as given; do not reopen resolved invariants.
- If the technical shape cannot support a product outcome you need, BOUNCE IT BACK as an
  ARCHITECTURE_CONTRACT amendment (name it, state why, propose the closest buildable product
  alternative) in a clear "Amendments bounced to Architect" section — do not silently narrow scope.

You are FIRST to write the PRODUCT_CONTRACT, so write it into the existing
.claude/contracts/{FEATURE}/ folder; there is no inbound PRODUCT_CONTRACT skeleton — you set its
structure. Stay in your lane (no UI layout, no endpoints, no code). Make every acceptance criterion
observable without reading code, and restate any product-level constraint the next role must not
violate.

When the contract is locked, run compressor #2 (Session-Transition) from
.claude/COMPRESSOR_PROMPTS.md targeting the UX/Tech-Writer, then stop.
```
> Sequencing gate: if you bounce amendments back to the Architect, they should be resolved in the
> ARCHITECTURE_CONTRACT **before** UX starts, so UX never builds on a contested technical shape.

## 2b. Product Manager — PM-first entry (exploratory features only)
Use this **instead of** sections 1+2 when the dominant uncertainty is product, not feasibility
(see "Choosing the entry point" above). The PM is the first role; the Architect runs *after* via
**section 1b** and validates feasibility. Everything from section 3 (UX/Tech-Writer) onward is
unchanged.
```text
Read these files for full context, then act as a strict Product Manager opening a NEW feature
(PM-first entry — you are the FIRST role; there is NO ARCHITECTURE_CONTRACT yet):
- .claude/GAMMAFLOW_CONTEXT.md      (standing ground truth)
- .claude/OPEN_THREADS.md           (background: what's open / resolved — do not reopen "resolved")

Goal: {GOAL}

Use this entry only when the dominant uncertainty is PRODUCT, not feasibility (fuzzy user need,
several plausible product shapes, all technically cheap). If the goal is gated by data/vendor
coverage or a math invariant, stop and run Architect-first (section 1) instead.

You are FIRST, so: create the folder .claude/contracts/{FEATURE}/ and write your contract there.
There is no inbound skeleton — you set the structure.

Your job (stay in lane — NO code, math derivations, data structures, endpoints, payload/field
names, or UI layout): user stories, feature scope (In / Out / Future-dated), dashboard behavior,
and acceptance criteria. Every acceptance criterion MUST be observable without reading code.

Be a STRICT PM — decide, don't survey:
- Where a sensible default exists, MAKE the product call and record it in a "Product decisions made
  here (so the Architect isn't guessing)" section. Do not punt decidable product questions to the
  Architect.
- Keep that strictly separate from a "Feasibility questions for the Architect" section: every
  technical/data/feasibility assumption your scope leans on goes here, FLAGGED not resolved (no
  data structures, endpoints, payloads, math, or UI).

Because no Architect has set the constraint envelope, you MUST also:
- Restate the binding constraints from GAMMAFLOW_CONTEXT this feature must respect — math invariants
  (gamma sourcing, rates, DTE-filter scope) AND the product invariants (dark-pool-is-context,
  live-vs-cached isolation, honest live-vs-stale, no overnight data, the external-AI contract, the
  over-trading guard) — and avoid acceptance criteria that obviously violate them.
- Restate any product-level constraint the NEXT role must not violate.
- If the goal names an adjacent or future capability, capture it as Future-dated + a "Design-for"
  seam note (what must not be precluded) + a feasibility question — do NOT scope it into this phase.

Write your output to .claude/contracts/{FEATURE}/PRODUCT_CONTRACT.md.

When the contract is locked, run compressor #2 (Session-Transition) from
.claude/COMPRESSOR_PROMPTS.md targeting the ARCHITECT (not the UX/Tech-Writer). The Architect then
writes ARCHITECTURE_CONTRACT.md, answers your feasibility questions, and bounces any un-buildable
acceptance criterion back to you as a PRODUCT_CONTRACT amendment before the pipeline continues to
UX. Then stop.
```
> Handoff note for the flipped flow: the Architect runs next via **section 1b** (validation pass),
> targeting the **UX/Tech-Writer** on its own handoff — the PM has already run. Any feasibility
> conflict the Architect finds is a **PRODUCT_CONTRACT amendment** bounced back to the PM, not a
> silent Architect-side scope change.

## 3. UX/Tech-Writer (Session 3)
```text
Read these files for full context, then act as a UX designer + technical writer:
- .claude/GAMMAFLOW_CONTEXT.md                          (standing ground truth)
- .claude/contracts/{FEATURE}/PRODUCT_CONTRACT.md       (your input: stories, scope, behavior, ACs)

Do NOT change product scope or invent new behavior — translate the PRODUCT_CONTRACT into concrete
UI/interaction design and user-facing copy. Your job: component states (default / loading / stale /
offline / empty / error), where each datum surfaces, microcopy and labels (honoring binding
framing — e.g. dark-pool blocks are "context, not a signal"), tooltip/glossary text, and the exact
degraded-state wording for live-stream loss vs bundle-fetch loss. Map each acceptance criterion to
the component state(s) that satisfy it.

Stay in your lane: no server internals, no math, no final endpoint/payload schema decisions beyond
naming the fields the UI must consume.

When the design + copy are locked, run compressor #3 (Split Context) from
.claude/COMPRESSOR_PROMPTS.md. It emits the three execution files for decoupled build:
INTERFACE_CONTRACT.md, BACKEND_EXECUTION_CONTRACT.md, FRONTEND_EXECUTION_CONTRACT.md. Then stop.
```

## 4. Backend Executioner
```text
Read these files for full context, then implement the backend, acting as a backend engineer:
- .claude/GAMMAFLOW_CONTEXT.md                                  (standing ground truth)
- .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md            (the single source of integration truth)
- .claude/contracts/{FEATURE}/BACKEND_EXECUTION_CONTRACT.md    (your server work)

Build only the server side. Emit exactly the fields/types/presence-and-error semantics the
INTERFACE_CONTRACT specifies — that contract is binding; do not deviate from it unilaterally (if it
is wrong, flag it, don't silently diverge). Honor every constraint in GAMMAFLOW_CONTEXT (gamma
sourcing, rates, DTE-filter scope, best-effort dark-pool, path isolation). Do not touch UI.

Run the project the standard way and verify your output matches the INTERFACE_CONTRACT (shape,
presence rules, and the failure/degradation semantics). Report what you changed and how you
verified it. If you discover an interface gap, note it for a contract amendment rather than
breaking the frontend's assumptions.
```

## 5. Frontend Executioner
```text
Read these files for full context, then implement the frontend, acting as a frontend engineer:
- .claude/GAMMAFLOW_CONTEXT.md                                  (standing ground truth)
- .claude/contracts/{FEATURE}/INTERFACE_CONTRACT.md            (the single source of integration truth)
- .claude/contracts/{FEATURE}/FRONTEND_EXECUTION_CONTRACT.md   (your UI work + component states)

Build only the client side. Consume exactly the fields the INTERFACE_CONTRACT defines — that
contract is binding; do not assume fields it doesn't promise. Implement every component state and
the exact degraded-state behavior from the FRONTEND_EXECUTION_CONTRACT (static GEX chart + stats
MUST persist on live-stream loss; only live fields show offline/stale; never blank on a failed
refresh once a bundle has loaded; auto-reconnect). Do not touch server internals or math.

Run the project the standard way and verify the live-loss / stale / cold-start states behave as
specified against the acceptance criteria. Report what you changed and how you verified it. If a
needed field is missing from the interface, flag it for a contract amendment — do not invent it.
```

---
### Notes
- **Backend and Frontend run in parallel** — both bind to the same `INTERFACE_CONTRACT.md`, so neither
  blocks the other. That decoupling is the whole point of compressor #3.
- Executioners have **no outbound contract** (they ship code, not a handoff) and therefore run **no
  compressor** — the pipeline ends at integration.
- If a role finds its inbound contract wrong or incomplete, the fix is a **contract amendment** (bounce
  back to the owning role), not a silent in-lane workaround.
- Keep `GAMMAFLOW_CONTEXT.md` as the constant every session reads; the per-feature contracts are the
  variable. Archive a feature's folder when it ships.
