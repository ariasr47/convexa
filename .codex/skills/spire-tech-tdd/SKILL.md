---
name: spire-tech-tdd
description: Use when deciding how a change is verified — the cheapest check that catches what could go wrong — and when writing a check that is owed, including proof that it can fail. Prefer spire-tech-risk-based-verify for SPEC Verify-by marks, spire-tech-flow-integration-tests for journey shape, spire-tech-debugging for an existing red.
---

# Verification strategy — the cheapest check that catches the risk

Decide what proves this change, write only what is owed, and prove each owed check can fail.

A role or plan that mandates red-first governs over this skill's discretion.

**Exit artifact:** a PLAN budget row, a `**Red-first:**` mark, or a done-report line naming the check and its evidence; no new document.

## Critical procedure

1. **What could go wrong.** One sentence, as harm to a user or data; for a §3 `test` row, its `Silent if:`.
2. **Take the mark as given; the floor comes first.** A §3 row's `Verify by` mark is decided; never re-mark it. All work, rowed or not, meets step 4's floor first: a floor class owes a test whatever the mark. Beyond the floor, a test is owed only by a §3 `test` row or a §7 owed item; with none of these, record what you checked and stop.
3. **The cheapest adequate check.** First match in the table. Already guarded: name the existing check and prove it can fail on this failure by step 7; a named check that stays green when the guarded behavior is broken guards nothing, and the owed test is written.
4. **The floor — a test is owed whatever the mark or the table says.** Floor classes: an authorization or tenant guard; money arithmetic; a write, migration or destructive operation that can lose or corrupt stored data; a bug fix whose failure was silent or may recur (a reproduction test; a visible one-off bug in a low-risk area may close on recorded review). Owner policy: any gate, validator or guard (code whose job is to refuse, such as a data-write refusal).
5. **When a new test is owed.** A §3 `test` row, a §7 owed item (promoted invariants count through §7) or a floor class, unless an existing check proven under step 3 meets it. Nothing else.
6. **When red-first applies.** It is the default way to get step 7's proof when the expected result is statable before the code (floor items, reproductions); else write the test alongside. Small steps with a check after each are what the evidence carries, not the order (Fucci 2017). The PLAN's `**Red-first:**` mark records it per task. Gates, validators and guards: a can-fail proof is always owed and always recorded; red-first is the default way to get it.
7. **Prove each owed check can fail,** a named existing check included: see it fail once for the intended reason: red before the code exists, or break the guarded behavior once, run it red, restore, run it green. A typo, fixture crash or unrelated failure is not that red. Record command, intended red, restoration and final green as one done-report line. Do not add a permanent test per mutation.

## Kind of work

| Kind of work | Cheapest adequate check |
|---|---|
| impossible states, FE↔BE drift | types, a boundary schema parse or the conformance spec; no per-field tests |
| already guarded | prove it fails on this failure (steps 3, 7); no new test |
| a rule, parser or transition with a statable answer | an example test per behavior or boundary, lowest layer; expected values from the criterion |
| large input space, cheap oracle | a property test, optional |
| money or permissions | floor: a test; negative cases |
| a data migration | floor: a test; rehearse on a copy, reconcile counts, undo plan; owner's go where required |
| critical user journey | the core path plus the one failure that matters |
| UI layout, copy, visual, motion | review with screenshots; no style, class-name or copy assertions; no pixel check |
| component state handling | a union type, exhaustively handled; a test only for transition logic; a screenshot per state |
| third-party integration | parse inbound payloads; recorded samples; stub at the network edge |
| a spike | no test until the code is kept; then apply this procedure |
| a bug fix | floor: a reproduction test if the failure was silent or may recur; first by default |
| refactoring untested risky code | characterization checks, removed where they pin accidental behavior |
| a gate, validator or guard | floor: a can-fail proof (steps 6, 7) |

## The oracle is binding

Never weaken a test to accommodate the implementation. A failed assertion is either a product defect, a test defect proven against the requirement, or a plan/spec contradiction that must stop at GATE Z. Broadening `equal` into “truthy,” deleting a negative assertion, accepting more outcomes, or skipping the failure path makes the suite green by removing the behavior.

A test that asserts nothing or tolerates the behavior's absence is hollow coverage.

## Reference routing

| Read when | Reference |
|---|---|
| Assertions, fixtures, mocks | [Writing good tests](references/writing-good-tests.md) |
| Red-first, can-fail proof | [Red-first and can-fail proof](references/exceptions-and-mutations.md) |

## Stop conditions

Stop when the intended failure cannot be produced or the expected behavior contradicts the plan or spec (GATE Z); report it, never reinterpret it.

## Do not

- Do not write a test only because code changed.
- Do not lower the floor.
- Do not name an existing check as a guard without its can-fail proof.
- Do not assert source text, CSS values, class names, copy or pixel goldens.
- Do not weaken an oracle.
- Do not derive expected values from the implementation.
- Do not exceed the budget without a one-line reason.
- Do not mock the unit whose behavior the test claims to prove.
- Do not add production APIs used only by tests.
