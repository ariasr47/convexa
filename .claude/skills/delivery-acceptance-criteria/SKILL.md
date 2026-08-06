---
name: delivery-acceptance-criteria
description: Write acceptance criteria in this kit's table format with its risk-based verification marker. Use when drafting a product position at council R1, when authoring SPEC.md section 3 at R4, or when reading criteria at GATE Q.
---

# Acceptance criteria — this kit's format

Acceptance criteria live in one table, in `SPEC.md` under `## 3. Acceptance criteria (with user
stories)`. The shape is fixed, and a structural gate (`contract_lint` M8) requires the section to be
present — but nothing machine-checks the columns, so they are yours to keep right:

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | As a … I want … so that … | <observable outcome> | test \| review |

`SPEC_TEMPLATE.md` is the authority for structure. This skill governs what goes in the rows.

## The `Verify by` column is the point

Verification of every criterion is mandatory. The METHOD is risk-based:

- **`test`** — an automated check. Use it for invariants, for negative space, and for behavior that
  could regress silently with nobody noticing.
- **`review`** — verified by inspection, and recorded as such. Use it for copy, presence, ordering,
  and anything visible and intentional where a person looking at it is the honest check.

Choose the layer by risk too: prefer ONE high-level integration, end-to-end or accessibility check
over many small pokes, and never split a single behavior into an assertion per row. A suite that
asserts nothing does not count as verification.

## What makes a criterion well-formed

- **Observable without reading code.** A person can check it from outside. If confirming it means
  opening a source file, it is not a criterion yet.
- **An outcome, not an intention.** "The list loads quickly" is an intention. "The list renders 50
  rows within 2 seconds on a cold load" is an outcome.
- **Degraded states get their own rows.** Stale, offline, empty, error, null and 404 are each their
  own criterion. Buried inside a happy-path row is how they ship unhandled.
- **Priority is a decision, not a label.** If everything is critical, nothing is. Say plainly which
  criteria block the ship.

## Do not

- Do not restate the interface. `INTERFACE_CONTRACT.md` is the single truth for endpoints and fields;
  name it, never copy it.
- Do not produce a document. This skill fills one section of an artifact the kit already owns.
