# When red-first is owed, and proving a check can fail

## When red-first is owed

Red-first is the default way to get the can-fail proof when the expected result can be stated before the code: floor items, bug reproductions, rules with worked examples. Otherwise write the test alongside the code, then prove it can fail by breaking the guarded behavior once. Small steps with a check after each are what the evidence carries, not the order.

The plan records the choice per task as `**Red-first:** yes|no — <reason>`. A role or plan that mandates red-first governs over this discretion. Gates, validators and guards are decided in the skill's step 6.

## Mutation proves the rejecting side

Every owed check, a named existing check included, is seen failing once for the intended reason. Use mutation when the check was not written red first, or when the claim is that a test, validator or gate prevents a class of defect:

1. Start from green.
2. Plant one minimal violation that the check is supposed to reject.
3. Run the exact check and observe the intended failure, not a syntax error or unrelated crash.
4. Restore the original byte.
5. Rerun and observe green.

Useful mutations include deleting a required field, weakening an invariant, admitting a traversal, changing one expected byte, removing an authorization check, or making a supposedly forbidden output possible.

## Avoid self-fulfilling tests

Do not derive the mutation from the implementation's own table and then iterate that same table in the test. State an independent oracle so deleting an implementation entry makes the test fail rather than shrinking both sides together.

## Record the evidence

Report the mutation, the exact command, the intended RED, the restoration and the final GREEN as one done-report line. If the mutation stays green, the claimed enforcement does not exist; fix the check before reporting completion.
