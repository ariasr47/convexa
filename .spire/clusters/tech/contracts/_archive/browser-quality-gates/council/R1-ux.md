# R1 — ux position: browser-quality-gates

## Position

### User, job, and hard boundary

The intended user is a Convexa developer or reviewer deciding whether a frontend change is safe to
merge. Their primary job is to run one named gate, understand exactly what was and was not checked,
and move from a failure to the relevant trace, accessibility finding, or image diff without guessing.

This feature is `NO_UI_CHANGE`. Its user-facing surface is the terminal plus generated local/CI
artifacts. It must add no route, in-app operator panel, trader copy, style, token, component, motion,
or runtime package. It must not change API behavior, scoring, fixtures consumed by production code,
or any trader-visible default/loading/empty/error/offline/stale state. Test-only axe injection is not
application code and must never enter the dashboard bundle.

At R1 observation, the live repository has Playwright 1.62.1 and `npx playwright test --list`
reports 52 Chromium tests in five files. The existing `npx nx run dashboard-e2e:e2e` target remains
the full Chromium suite. Firefox and WebKit are deliberately absent from the current project list;
there is no first-party axe integration and no `toHaveScreenshot` baseline. These are inventory
facts, not claims that any suite currently passes.

User vocabulary is deliberately narrow:

- **Chromium**, **Firefox**, and **WebKit** name Playwright-managed browser engines. The policy must
  not silently rename them Chrome, Edge, or Safari.
- **Compatibility journey** means a small end-to-end path intentionally selected for all three
  engines. It does not mean the entire Chromium suite.
- **Accessibility finding** means an axe result with axe's own `critical`, `serious`, `moderate`, or
  `minor` impact. It does not mean a complete WCAG audit.
- **Visual baseline** means a reviewed expected screenshot for one named viewport, theme, fixture,
  state, engine, and host platform. **Update** means candidate image bytes were written; it never
  means the change was approved.
- **Local evidence** and **hosted evidence** remain distinct. A local pass must never be reported as
  a GitHub-hosted pass while hosted runners are unavailable.

No design-system amendment is needed. Test fixtures must preserve The Curvature Terminal as shipped:
both themes, token-backed warning/focus semantics, the 393px terminal floor, the existing one-motion
budget, reduced-motion behavior, the vertical GEX chart, and the live/static degraded-state split.
Baseline creation records the current approved surface; it is not permission to re-style it.

### Supported-browser policy copy

The repository-owned policy should use this exact framing:

> Tested browser engines: the Chromium, Firefox, and WebKit versions installed from Convexa's locked
> Playwright toolchain. Chromium runs the full end-to-end suite. Firefox and WebKit run the bounded
> compatibility journeys named in this repository. This policy does not claim coverage for every
> released Chrome, Edge, Firefox, or Safari version.

The report for every run must print the actual Playwright version and project/engine name that
produced the evidence. A generic line such as “all browsers supported” is forbidden.

### Information structure and commands

The command hierarchy should be one aggregate check, four inspectable child gates, and one visibly
separate mutation command. Existing Chromium behavior stays addressable at its existing Nx target.

| Operator intent | Nx target | npm command | What it may do |
| --- | --- | --- | --- |
| Retain the full existing suite | `dashboard-e2e:e2e` | `npm run browser:chromium` | Run all Chromium tests; never select Firefox/WebKit implicitly |
| Check the bounded engine matrix | `dashboard-e2e:compat` | `npm run browser:compat` | Run only named compatibility journeys in Chromium, Firefox, and WebKit |
| Check automated accessibility | `dashboard-e2e:a11y` | `npm run browser:a11y` | Run axe plus the named semantic/keyboard assertions over representative states |
| Compare approved screenshots | `dashboard-e2e:visual` | `npm run browser:visual` | Compare only; missing or changed baselines fail |
| Deliberately write candidate screenshots | `dashboard-e2e:visual-update` | `npm run browser:visual:update` | Update only the current platform's visual candidates; never imply approval |
| Run the merge floor | `dashboard-e2e:quality` | `npm run browser:quality` | Run Chromium + compatibility + accessibility + visual checks; never update baselines |

`browser:quality`, `npm run ci`, and CI workflow commands must have no path to
`browser:visual:update`. Zero selected tests is a failure, never a green empty state. Gate runs must
fail on flaky tests: a pass obtained only after a retry is not “stability-clean.”

The install recovery command shown locally is:

`npx playwright install chromium firefox webkit`

CI may use Playwright's `--with-deps` form, but local copy must not prescribe a Linux dependency
install to every host.

### Bounded compatibility journeys

Firefox and WebKit should receive a deliberately small five-journey matrix, also executed in
Chromium as the reference arm:

1. Public landing → Ticker client-side navigation, browser Back/Forward, and route parameter binding.
2. Content-full Ticker load from deterministic REST fixtures, followed by a simulated stream loss
   proving live UI degrades while static content remains.
3. Signed-out protected-route entry proving the auth wall appears, then the shared sign-in dialog's
   keyboard entry/close/return-focus path.
4. Signed-in dense Positions load with a broker option group expanded and reachable by keyboard at
   393px.
5. Signed-in dense Scanner load at table and mobile-card widths, including its last-known/worker-down
   degraded state.

The full 52-test Chromium inventory must not be parameterized blindly across all engines. Each
compatibility journey needs a readiness/vacuity assertion before its load-bearing assertion so a
blank or error page cannot pass as compatible.

### Application-state coverage

There is no new application component state. The gates exercise existing states and must not change
their words or behavior.

| Existing state | Representative surface | What the test observes | What must not happen |
| --- | --- | --- | --- |
| Default | Public Landing; content-full Ticker | Primary landmarks, navigation, named controls, dense data/charts render | A shell-only or blank render must not satisfy the check |
| Loading | Lazy route fallback and Ticker cold skeleton | Loading has an accessible name/status and resolves to a named ready or error state | Axe must not run early and report a half-mounted page as the result |
| Empty | Scanner zero rows; broker not connected/no credential | Honest empty/not-connected content and a usable next action where shipped | Empty must not be inferred from a failed request or missing fixture |
| Error | Ticker cold failure; route error boundary | Error is programmatically discoverable and recovery remains keyboard reachable | Failure must not masquerade as an empty or successful page |
| Offline | Ticker stream loss after a successful bundle | Live-derived UI carries its offline marker/dimming while static content remains | Static content must not blank or be relabeled live |
| Stale | Stale bundle or post-success refresh failure | Last content remains with its shipped stale/refresh disclosure | Stale must not be called current or be collapsed into offline |
| Success/confirmation | Shared sign-in/dialog completion paths already present in the app | Focus moves/returns intentionally and status is announced where the shipped flow has a confirmation | The test must not invent new success copy or claim a server write it did not perform |
| Dense | Positions, Scanner, AI decision analysis, expanded broker group | Keyboard access, zoom/narrow-width resilience, and no horizontal overflow | Dense fixtures must not be replaced by sparse fixtures just to make checks pass |

### Gate states and exact degraded copy

The operator surface has its own complete state set. Placeholders in braces must be populated from
the run result, never from hard-coded counts.

| Gate state | Exit | Exact operator-facing wording |
| --- | --- | --- |
| Running | pending | `[RUNNING] {gate} — Playwright {version} — {project_or_engine} — {selected} selected` |
| Passed cleanly | 0 | `[PASS] {gate} — {passed}/{selected} passed — 0 flaky` |
| Compatibility failure | non-zero | `[FAIL] compatibility — {engine} — {journey}. Open: {artifact_path}` |
| Accessibility threshold failure | non-zero | `[FAIL] accessibility — {surface} · {state}: {serious} serious, {critical} critical. Automated checks do not replace manual accessibility review. Open: {artifact_path}` |
| Visual mismatch | non-zero | `[FAIL] visual — {scenario}: the approved baseline differs. Review expected, actual, and diff images. Open: {artifact_path}` |
| Flaky/retried | non-zero | `[FAIL] {gate} — {flaky} test(s) passed only after retry; no stability-clean pass recorded. Open: {artifact_path}` |
| Browser missing | non-zero | `[BLOCKED] browser prerequisites — {engine} is not installed. Run: npx playwright install chromium firefox webkit` |
| App server unavailable | non-zero | `[BLOCKED] dashboard unavailable at {base_url}; no browser result recorded.` |
| No tests selected | non-zero | `[FAIL] gate selection — 0 tests selected; no pass recorded.` |
| Candidate baselines written | 0 only after files are written | `[UPDATED] visual candidates — {written} baseline file(s) written for {platform}. This does not approve them. Review the image and git diffs, then run: npm run browser:visual` |
| Hosted run unavailable | no hosted verdict | `[NOT RUN] hosted browser quality — hosted-runner evidence is unavailable. Local results do not count as hosted evidence.` |

Do not use “browser unsupported” for a failed journey: the evidence only proves that the named gate
failed. Do not use “WCAG compliant,” “accessible,” “pixel perfect,” “verified,” or “approved” in a
generated pass/update line. The artifacts support narrower claims.

Each target writes a distinct artifact directory under the existing
`apps/dashboard-e2e/test-output/playwright/` seam and prints its resolved path. Failures retain a
trace and screenshot when Playwright can produce them. Accessibility runs retain machine-readable
findings with route/state, rule id, impact, help URL, and affected selector; visual failures retain
`expected`, `actual`, and `diff` images. An artifact-generation failure is itself non-zero and must
say that evidence is incomplete.

### Accessibility semantics and scope

Automated WCAG-oriented coverage is a serious/critical regression gate, not a certification. Axe's
`serious` and `critical` impacts fail the target. `moderate` and `minor` findings remain visible in
the artifact and summary; they must not be silently dropped even though they do not set this gate's
threshold.

The representative matrix is:

- public Landing in dark and light themes;
- Ticker content-full, loading, cold-error, offline-after-success, and stale-after-success states;
- signed-out auth wall plus the open sign-in dialog;
- authenticated dense Positions, including an expanded group and any existing confirmation dialog;
- authenticated Scanner in dense, empty, and worker-down/last-known states at table and mobile-card
  widths;
- Settings with its labeled controls and validation/error state.

Axe runs only after a state-specific ready anchor is asserted. Network-idle is not a readiness oracle
because the product has SSE. Every fixture is deterministic and every scan records route, theme,
viewport, auth state, and application state.

Axe is paired with explicit real-browser assertions for semantics it does not prove reliably by
itself:

- keyboard order reaches every primary action without a pointer;
- `:focus-visible` is visible and not duplicated, and modal focus is contained and returned;
- actions use buttons, navigation uses links, inputs have persistent accessible names, and dense
  tables/cards expose usable names/relationships;
- loading and non-blocking status updates are announced without stealing focus; blocking errors are
  discoverable;
- state is never conveyed by color alone, including offline/stale/error and signed direction;
- 200% zoom and the 393px viewport do not hide the focused control or cause horizontal page overflow;
- reduced motion is honored without removing state information.

The gate must not weaken an oracle to accommodate an existing violation. A real finding either fails
at the stated threshold or is explicitly ruled and recorded outside this feature; it is never hidden
with a broad exclusion. Any narrowly excluded third-party node names the rule, selector, reason, and
owner-visible removal condition.

### Visual baseline set and review/update flow

Visual comparison is Chromium-only. Running screenshot comparisons across three rasterizers would
turn engine antialiasing into noise and would duplicate the compatibility gate. The bounded baseline
set is six high-risk compositions:

1. Landing — 393×852 — dark — public default.
2. Ticker — 1280×900 — dark — content-full with clustered GEX markers.
3. Ticker — 393×852 — light — successful bundle plus live-offline degradation.
4. Positions — 393×852 — dark — authenticated dense multi-leg book with one disclosure expanded.
5. Scanner — 900×900 — light — authenticated dense table with deterministic last-known rows.
6. AI recommendation analysis — 393×852 — light — produced dense decision with the analysis sheet
   open.

Every snapshot identity includes scenario, viewport, theme, state, Chromium project, and host
platform. Windows-local and Linux-CI baselines are platform-scoped rather than compared to each
other. The same scenario inventory must exist on both platforms once hosted execution is available;
until then, a Windows local pass is local evidence only.

Determinism requirements are observable: fixed network fixtures; fixed clock/time zone/locale;
self-hosted fonts awaited before capture; stable viewport and device scale; caret hidden; reduced
motion selected; lazy content and charts at a named ready point; no real SSE, API, account, vendor,
or current date; volatile identifiers and timestamps fixture-fixed rather than broadly masked.
Masks are allowed only for a field whose variability is itself out of scope and must be named beside
the snapshot. Any changed pixel fails; two identical check runs must remain clean. Missing baseline
files fail the check target rather than being created implicitly.

The review/update flow is intentionally asymmetric:

1. Run `npm run browser:visual`. On drift, open the HTML report and inspect expected, actual, and
   diff images at the named scenario.
2. Decide whether the rendered application change is intended and consistent with the project canon.
   A failure is not fixed by updating the baseline first.
3. After explicit owner/design-review approval, run `npm run browser:visual:update`. Its output says
   **candidate written**, never **approved**.
4. Review every changed image and the source diff. The update must not modify snapshots outside the
   six-case inventory or outside the current host platform.
5. Run `npm run browser:visual` twice. Both runs must pass with zero flaky tests and no further image
   change before the baseline commit is eligible to merge.

CI is compare-only and uploads visual artifacts on failure. Hosted CI evidence remains `NOT RUN`
while hosted runners/billing are unavailable; wiring or local success is not a hosted receipt.

### UX acceptance criteria and AC→state mapping

These are the UX-owned criteria the synthesizer should fold against the PM criteria rather than
creating a second test matrix.

| ID | Observable criterion | Component/test state(s) | Verify by |
| --- | --- | --- | --- |
| UX-1 | The repository policy uses the exact engine-scoped framing above and makes no branded-browser or all-versions promise. | Documentation default | `review` |
| UX-2 | `dashboard-e2e:e2e` remains the full Chromium suite; the observed 52-test inventory is not blindly multiplied across Firefox/WebKit. | Default/pass; selection error | `test` |
| UX-3 | Each of the five compatibility journeys runs in Chromium, Firefox, and WebKit and fails on a broken or blank journey arm. | Default, offline, auth, dense, worker-down | `test` |
| UX-4 | The aggregate quality command runs every check target and has no path to baseline update. | Running, pass, fail | `test` |
| UX-5 | A gate with zero selected tests exits non-zero and records no pass. | Empty selection | `test` |
| UX-6 | A test that passes only after retry makes the quality gate non-zero and is labeled flaky. | Flaky/degraded | `test` |
| UX-7 | Missing browsers or an unavailable app server exits non-zero and records no pass. | Browser missing; server unavailable | `test` |
| UX-8 | Blocked-prerequisite output uses the exact recovery/no-evidence wording above. | Browser missing; server unavailable | `review` |
| UX-9 | Axe scans the named public, authenticated, dense, and degraded states only after a state-specific readiness assertion. | Default, loading, empty, error, offline, stale, dense | `test` |
| UX-10 | Any axe `serious` or `critical` finding fails while moderate/minor findings remain in the summary and artifact. | Accessibility pass/fail | `test` |
| UX-11 | Accessibility output never claims WCAG compliance or whole-product accessibility and carries the exact manual-review disclaimer. | Accessibility pass/fail | `review` |
| UX-12 | Real-browser checks cover keyboard order, visible focus, modal containment/return, named controls, announcements, non-color cues, reduced motion, 200% zoom, and 393px focus/overflow resilience. | Default, dialog open/close, error, offline, stale, dense | `test` |
| UX-13 | Accessibility exclusions cannot be broad: every exclusion names a rule, selector, reason, and removal condition. | Accessibility degraded/excluded | `review` |
| UX-14 | The six named Chromium screenshots compare by scenario, viewport, theme, state, and platform; missing or changed baselines fail. | Visual default, offline, dense, sheet-open | `test` |
| UX-15 | Fixed fixtures/clock/locale/fonts/readiness/reduced motion make two identical visual checks clean without broad masks or real services. | Visual loading→ready; repeat run | `test` |
| UX-16 | Visual failure artifacts contain expected, actual, and diff images. | Visual mismatch | `test` |
| UX-17 | Visual mismatch output uses the exact review-required wording above. | Visual mismatch | `review` |
| UX-18 | The update target writes only current-platform candidate baselines. | Visual update confirmation | `test` |
| UX-19 | Update output says candidate files were written and does not say they were approved. | Visual update confirmation | `review` |
| UX-20 | After update, two compare-only runs pass without retry or further image change before merge. | Updated→pass confirmation | `test` |
| UX-21 | A hosted-unavailable state cannot be recorded as PASS or another success state. | Hosted unavailable | `test` |
| UX-22 | Local and hosted evidence use the exact separate labels above. | Local pass; hosted unavailable | `review` |
| UX-23 | Every failure prints a resolved artifact path; incomplete artifact generation is non-zero and identified as incomplete. | Compatibility, accessibility, visual, artifact error | `test` |
| UX-24 | Production dashboard source, public assets, runtime dependencies, routes, copy, styles, motion, API behavior, and scoring remain unchanged. | All application states | `test` |
| UX-25 | Review of all six baselines confirms adherence to the SET design canon without restating or amending its token table. | Visual default/offline/dense | `review` |

## Risks I see

- Screenshot stability can become dishonest if Windows-local images are compared against Linux-CI
  output. Platform-scoped identities and explicit local-versus-hosted reporting are required.
- A full-suite three-engine parameterization would multiply time and triage noise while obscuring
  whether a failure is a critical journey incompatibility. The five-journey boundary must stay visible.
- Axe can create false confidence. Serious/critical automation must always carry the “not a complete
  manual accessibility review” statement, and keyboard/focus/zoom checks remain separate.
- Broad axe exclusions or screenshot masks can turn a green gate into absence of observation. Every
  exclusion needs a narrow, reviewable identity and removal condition.
- Existing CI retries can turn instability into a green result unless quality commands use the
  Playwright 1.62.1 `--fail-on-flaky-tests` behavior.
- SSE makes `networkidle` an invalid readiness signal. Without state-specific anchors, scans and
  screenshots can capture loading or blank content and pass vacuously.
- Baseline-update copy that says “approved” would fabricate human review. The tool can only say that
  candidate files were written.
- A browser-engine failure does not prove every branded browser based on that engine is unsupported.
  Output must name the tested engine/version and the failed journey only.
- The six visual cases intentionally leave much of the application outside screenshot coverage.
  Their names must stay explicit so “visual gate passed” is not read as whole-app visual coverage.
- `NO_UI_CHANGE` can be violated accidentally by “fixing” findings found during baseline creation.
  Any product correction requires a separately authorized scope; this gate may expose it, not smuggle
  it into test infrastructure.

## Assumptions I'm making about the other two lanes

- The PM lane will define merge authority so an owner/design reviewer, not the update command itself,
  accepts visual drift.
- The PM lane will accept an engine-scoped support policy and will not require unsupported claims for
  branded Chrome, Edge, Firefox, or Safari release ranges.
- The PM lane will keep automated accessibility failure at axe `serious` and `critical` while requiring
  moderate/minor findings to remain visible rather than silently waived.
- The PM lane will treat hosted browser evidence as unavailable until a real hosted run occurs, even
  if CI workflow wiring exists and all local gates pass.
- The architecture lane will provide distinct, non-overlapping test selection for full Chromium,
  bounded compatibility, accessibility, visual compare, and visual update targets.
- The architecture lane will make zero selected tests, flaky-after-retry results, missing browser
  binaries, server startup failure, and incomplete artifacts non-zero outcomes.
- The architecture lane will preserve the current `dashboard-e2e:e2e` target as the full Chromium
  suite and will not replace it with a three-engine project fan-out.
- The architecture lane will keep axe and screenshot tooling entirely in dev/e2e dependencies so
  production dashboard bundles and runtime source remain unchanged.
- The architecture lane will isolate screenshot baselines by host platform and expose the actual
  Playwright version/project in reports rather than asserting cross-platform byte identity.
- Both lanes will preserve the six-case visual inventory and five-journey compatibility inventory as
  bounded requirement sets, or raise any requested expansion as an explicit scope change.
