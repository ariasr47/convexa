# R3 — UX technical resolution

## Closest acceptable resolution

Use one checked gate manifest plus one aggregate Nx target as the selection authority. The manifest
names the full pre-feature Chromium inventory, the closed compatibility journey IDs and engine arms,
the accessibility state matrix, and the visual scenario IDs. Child targets consume those named sets;
they must not recreate selection with independent globs or CI-only command arguments. The aggregate
target depends on each check target exactly once and has no dependency or command path to
`visual-update`.

Both the root aggregate npm command and the hosted workflow invoke that aggregate Nx target once. CI
must not then invoke the Chromium, compatibility, accessibility, or visual check targets again as
separate execution steps. The architect's desired per-gate visibility remains, but moves to child-target
output and separately named artifact-publication steps rather than duplicate test invocations.

The aggregate selection must be non-overlapping. The retained 52-test Chromium suite runs once under
the existing full-suite target. The five compatibility journeys live in an explicitly separate
selection and run once per required Playwright project: Chromium, Firefox, and WebKit. The full-suite
target must not recollect those compatibility-only specs when both targets are scheduled by the
aggregate. This preserves the existing Chromium inventory and the three-engine reference matrix without
executing the Chromium compatibility journeys twice.

Each child target owns a distinct result and artifact directory and emits a machine-readable summary
containing its gate name, selected count, executed count, status, engine/state/scenario identity, and
resolved artifact paths. The aggregate preserves every child log and status, fails if any expected
summary is missing, and prints a roll-up by gate; it does not replay a child to obtain its result. CI
uses `if: always()` publication steps for each named directory so compatibility traces, accessibility
findings, and visual expected/actual/diff images remain independently discoverable even when another
gate fails.

Exactly-once execution is verified structurally: a dry-run/selection assertion must show one aggregate
node, one node for each child check, no `visual-update` node, no duplicate execution-unit key, and the
expected non-zero counts. A run receipt must likewise contain one terminal result per scheduled
execution-unit key. Any duplicate key, missing child summary, zero selection, or incomplete artifact
record makes the aggregate non-zero.
