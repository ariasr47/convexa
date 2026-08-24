# R3 — architect technical resolution

I accept the technical conflict. My R1 statement that CI runs the four gates as separately named
execution steps is withdrawn. Separate CI visibility does not require separate gate invocation.

## Resolution

`dashboard-e2e:quality` is the sole selection authority for both local and hosted execution. Its Nx
task graph has the closed check-only dependency set:

- `dashboard-e2e:e2e`
- `dashboard-e2e:compat`
- `dashboard-e2e:a11y`
- `dashboard-e2e:visual`

`dashboard-e2e:visual-update` is not in that graph and no check target can reach it. The root
`browser:quality` script invokes only `dashboard-e2e:quality`; the hosted workflow invokes that same
root script exactly once. CI must not also invoke any constituent browser target directly.

Nx task identity provides execution de-duplication: each constituent target is one node in the
aggregate graph, so shared dependencies or repeated references do not create a second gate run. The
aggregate invocation must run with task-bail disabled so independent sibling gates are allowed to
finish and emit evidence after another sibling fails; the final process remains non-zero if any gate
node fails. The build lane must verify the exact option against the repository's locked Nx version
rather than inventing executor syntax.

Each constituent target owns one stable artifact root below
`apps/dashboard-e2e/test-output/playwright/` and writes a machine-readable run summary there before it
exits. The summary records selected, passed, failed, flaky, and not-run counts plus resolved evidence
paths. Compatibility artifacts remain partitioned by engine and journey; accessibility artifacts by
surface and state; visual artifacts by scenario and platform; full-Chromium artifacts remain in their
own root. A target failure cannot overwrite or suppress a sibling's directory.

CI has one browser-execution step, followed by separately named, `always`-run publication steps for
the four artifact roots. Those publication steps upload/read existing evidence only; they do not run
Playwright or Nx targets. This preserves per-gate status and artifact visibility in the hosted UI while
the shared aggregate graph remains the only selector and each gate executes once. A missing expected
summary/artifact root is evidence-incomplete and makes publication non-zero; it is never interpreted as
a passing gate.

Structural guards must prove the topology:

1. The aggregate dependency set equals the four check targets exactly.
2. The update target is unreachable from the aggregate graph.
3. Local and hosted commands each contain one aggregate invocation.
4. The hosted workflow contains no direct constituent-target invocation.
5. Each gate maps to a distinct artifact root and an always-run publication step.

This keeps selection single-sourced, execution non-duplicated, failures isolated, and evidence
individually discoverable.
