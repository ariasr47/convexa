# R1 — pm position: browser-quality-gates

## Position

### Product position and value

This feature turns three presently implicit claims — “the app works outside Chromium,” “representative
surfaces have no high-impact automated accessibility findings,” and “high-risk presentation has not
drifted” — into repeatable release evidence. The buyer is the maintainer or reviewer deciding whether a
frontend change is safe to merge. The business value is lower regression risk without tripling the
existing browser bill or creating a screenshot-approval service to operate.

The support promise must be deliberately narrower than “works in every browser”:

- **Primary assurance:** the Playwright-pinned desktop Chromium engine runs the complete browser suite.
  The 52 scenarios present before this feature remain part of that primary suite; this feature may add
  checks but may not silently remove or weaken those 52.
- **Journey assurance:** the Playwright-pinned desktop Firefox and WebKit engines run only the bounded
  five-journey matrix below. A green result means those journeys passed on those pinned engines; it is
  not certification of every Firefox version, Safari release, operating system, device, embedded
  webview, extension combination, or assistive-technology pairing.
- **Responsive assurance:** named viewport checks are evidence about responsive browser rendering, not
  a claim that a real mobile operating system or device browser was tested.
- **Version currency:** the checked engines are the versions resolved by the repository's locked
  Playwright release. A Playwright upgrade is the explicit event that refreshes the engine versions and
  may require compatibility or baseline review.

The bounded cross-engine journey matrix is:

1. A public visitor can open the landing experience and reach a populated anonymous ticker experience.
2. A signed-in trader can navigate among Positions, Scanner, and Settings, including browser Back and
   Forward, without a document reload.
3. A signed-in trader can open a dense positions book, reach its expandable broker content by keyboard,
   expand it, and collapse it again.
4. A signed-in trader can open a dense Scanner state at the supported compact viewport without clipped
   or horizontally unreachable content.
5. A populated ticker experience can enter the stream-offline state while retained static information
   remains available and live-derived information is visibly degraded rather than blanked.

The matrix is intentionally journey-shaped. Firefox and WebKit must not collect the complete Chromium
suite. Chromium remains the deep safety net; the other engines detect engine-specific failures at the
few seams whose breakage would block a user from using the product.

### User stories

- As a maintainer, I want one local browser-quality command so that I can know whether compatibility,
  accessibility, or approved visual presentation regressed before I push.
- As a reviewer, I want each failure to name its gate, engine, state, and evidence so that I can
  distinguish a product defect from missing test infrastructure.
- As a trader using a non-Chromium engine, I want the essential public, authenticated, dense, and
  degraded journeys exercised so that basic use is not silently Chromium-only.
- As a keyboard or assistive-technology user, I want serious and critical automated findings to block
  release in representative states while the product remains honest that automation is not a complete
  accessibility audit.
- As a design reviewer, I want a deliberately small visual baseline with explicit update authority so
  that a screenshot change cannot be accepted merely because a test command rewrote the expected image.
- As a release owner, I want local evidence to remain truthful while hosted runners are unavailable so
  that a local simulation is never reported as a hosted CI pass.

### Scope

#### In

- A checked-in browser assurance policy stating the primary, journey, responsive, and non-certification
  boundaries above.
- The complete existing Chromium suite, including its current 52-scenario inventory, retained as the
  primary browser gate.
- Exactly the five named journeys on pinned Chromium, Firefox, and WebKit, without collecting the rest
  of the suite on Firefox or WebKit.
- Automated WCAG-oriented scanning over representative states: public landing in both schemes; a
  populated public ticker; authenticated Settings; dense authenticated Positions; dense authenticated
  Scanner at the compact viewport; Scanner empty; ticker cold-load error; and ticker stream-offline with
  retained static content. Serious and critical findings block. Lesser findings remain visible for
  triage but do not block this slice.
- A bounded eight-image baseline: public landing at desktop dark; populated ticker at desktop dark and
  light; dense Scanner at the compact viewport dark and light; dense Positions at the compact viewport
  dark and light; and ticker stream-offline at desktop dark.
- Separate, discoverable local commands for browser compatibility, accessibility, visual checking,
  deliberate visual updating, and the aggregate browser-quality gate, exposed through both the project
  runner and root package scripts.
- Deterministic, synthetic states that need no live API, vendor, account, personal data, or market clock.
- Actionable failure evidence: browser traces for journey failures, rule/impact/location guidance for
  accessibility findings, and expected/actual/difference images for visual drift.
- CI check-only wiring that invokes the same aggregate quality behavior as local use and preserves
  failure artifacts when a hosted run actually occurs.
- Explicit honesty while GitHub-hosted runners or billing are unavailable: local evidence may prove the
  commands, but the feature must not claim a hosted run passed.

#### Out

- Multiplying the entire Chromium suite across Firefox and WebKit.
- Any change to trader-visible product behavior, copy, theme, motion, routes, data, API behavior,
  scoring, or backend runtime.
- Browser performance budgets, network-vendor conformance, or live-market correctness.
- Internet Explorer, legacy browser releases, beta/nightly channels, embedded webviews, browser
  extensions, real mobile-device labs, or every operating-system/browser combination.
- A claim of WCAG conformance, a manual accessibility audit, screen-reader certification, or one
  automated accessibility scan for every route and state.
- Making minor or moderate automated accessibility findings release-blocking in this slice.
- Screenshots for every page, component, breakpoint, state, or theme.
- Hosted screenshot services, dashboards, or paid visual-review products.
- Automatic baseline acceptance, baseline writes during ordinary checks, or baseline writes in CI.
- Grandfathering an in-scope serious or critical accessibility finding. Because product UI changes are
  outside this brief, discovery of one requires GATE Z rather than a silent exclusion.

#### Future-dated

- Real stable Chrome, Edge, Firefox, and Safari release/device coverage beyond the pinned Playwright
  engines, based on observed user share and support cost.
- Manual keyboard, screen-reader, zoom/reflow, and cognitive-accessibility audits, with any resulting
  broader browser or assistive-technology support promise.
- Promotion of recurring minor or moderate accessibility findings into blocking policy after an owner-
  approved triage period.
- Additional visual states only when a shipped regression demonstrates that the current eight-image
  risk set missed a materially costly class of drift.
- A recorded hosted CI pass and merge-required status only after GitHub-hosted execution is actually
  available. Workflow presence or a local CI-mode run is not that evidence.

### Product behavior

- **Check versus update:** ordinary compatibility, accessibility, visual, and aggregate commands are
  read-only with respect to approved baselines. Only the deliberately named visual-update command may
  produce candidate baseline changes. A maintainer invokes it intentionally; reviewers accept or reject
  the resulting version-controlled image changes through normal review. CI never invokes it.
- **Pass honesty:** a green gate reports non-zero executed counts for every engine or state family it
  claims. Discovering zero journeys, zero accessibility states, or zero visual comparisons is a
  configuration error, not “nothing failed.”
- **Failure honesty:** an unavailable engine, absent approved baseline, fixture setup failure, or browser
  launch failure is reported as infrastructure/configuration failure. It is never converted into a
  compatibility, accessibility, or visual pass.
- **Local state:** after locked dependencies and browser engines are installed, every gate runs from a
  clean checkout without a backend or internet market dependency. The aggregate command is the local
  pre-push answer.
- **Hosted state:** CI invokes the same check-only aggregate behavior. If hosted runners are unavailable,
  the release record says hosted execution is unavailable; it may separately cite local results.
- **Visual stability:** unchanged bytes and unchanged deterministic fixtures produce no visual changes
  on repeated checks in the same supported execution environment. A platform without an approved
  baseline fails clearly rather than creating one.
- **Accessibility boundary:** the automated scan reports all findings it discovers. Serious and critical
  findings fail; minor and moderate findings are reported for review. The result always states that the
  scan is WCAG-oriented automation, not a complete accessibility audit.
- **Artifact safety:** all browser evidence is generated from synthetic deterministic fixtures and must
  contain no real account credentials, personal records, or live-market secrets.

### Acceptance criteria

All criteria below are ship-blocking at GATE Q. Actual hosted execution is deliberately Future-dated
while hosted runners are unavailable; the current hosted criterion is truthful wiring and status, not a
fabricated hosted pass. `test` marks protect silent regressions; `review` marks cover visible policy or
wording. They do not imply one automated test per row.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As a maintainer, I want an honest support promise. | The published browser policy identifies Chromium as the complete-suite engine and Firefox/WebKit as five-journey engines, and names the pinned-engine, responsive-viewport, mobile-device, vendor-browser, operating-system, and assistive-technology limits of that evidence. | review |
| AC-2 | As a reviewer, I want version changes to be legible. | The published policy states that changing the locked Playwright release is the event that refreshes checked engine versions and triggers compatibility and baseline review. | review |
| AC-3 | As a maintainer, I want existing protection retained. | The primary Chromium command collects and executes every one of the 52 pre-feature browser scenarios; removal of any one of those scenarios makes the inventory check fail. | test |
| AC-4 | As a maintainer, I want bounded secondary coverage. | The Firefox command collects exactly the five named cross-engine journeys and does not collect the remainder of the Chromium suite. | test |
| AC-5 | As a maintainer, I want bounded secondary coverage. | The WebKit command collects exactly the five named cross-engine journeys and does not collect the remainder of the Chromium suite. | test |
| AC-6 | As a non-Chromium trader, I want essential journeys protected. | With deterministic successful fixtures, each of the five named journeys completes on each of the three pinned engines. | test |
| AC-7 | As a reviewer, I want an engine failure localized. | When a journey is deliberately broken for one engine, the compatibility command exits non-zero and identifies the failing engine and journey in its result. | test |
| AC-8 | As a reviewer, I do not want an empty suite called green. | If any promised engine collects zero matrix journeys, the compatibility command exits non-zero as a configuration failure. | test |
| AC-9 | As an accessibility user, I want representative states scanned. | A clean accessibility run reports that it scanned every named public, authenticated, dense, empty, cold-error, and stream-offline state in scope. | test |
| AC-10 | As an accessibility user, I want high-impact regressions blocked. | Introducing one known serious or critical automated accessibility violation into an in-scope state makes the accessibility command exit non-zero and identify the affected state. | test |
| AC-11 | As a maintainer, I want lesser findings visible without silently widening scope. | A known minor or moderate finding appears in the accessibility report but does not by itself make the accessibility command fail. | test |
| AC-12 | As a reviewer, I want accessibility failures actionable. | Every reported accessibility finding includes its rule, impact, affected state, affected element context, and remediation reference. | test |
| AC-13 | As a reviewer, I do not want a skipped scan called clean. | If the accessibility scanner does not execute against one of the named states, the accessibility command exits non-zero as a configuration failure rather than reporting zero violations. | test |
| AC-14 | As an accessibility user, I want an honest claim. | Every accessibility summary states that automated WCAG-oriented scanning is not a complete manual accessibility audit or assistive-technology certification. | review |
| AC-15 | As a design reviewer, I want a bounded visual gate. | The visual check compares exactly the eight approved state/viewport/scheme baselines in scope; an unreviewed ninth baseline makes the inventory check fail. | test |
| AC-16 | As a maintainer, I want stable reruns. | Two visual checks from unchanged bytes and fixtures in the same supported execution environment both pass with zero unexpected visual pixels. | test |
| AC-17 | As a maintainer, I want ordinary checks read-only. | Running the visual-check command leaves every approved baseline byte unchanged. | test |
| AC-18 | As a reviewer, I want visual drift blocked. | Deliberately changing an in-scope rendered state makes the visual-check command exit non-zero. | test |
| AC-19 | As a reviewer, I want visual drift diagnosable. | A failing visual comparison produces expected, actual, and difference images named for the affected state, viewport, and scheme. | test |
| AC-20 | As a maintainer, I do not want absence treated as approval. | If an approved baseline is missing for the current supported execution environment, the visual-check command exits non-zero and names the missing state. | test |
| AC-21 | As a maintainer, I do not want checks to manufacture approval. | A missing baseline remains missing after the visual-check command; the command does not create an expected image. | test |
| AC-22 | As a design reviewer, I want deliberate update authority. | Only the explicitly named visual-update command produces candidate expected-image changes, and those changes appear as reviewable version-controlled differences. | test |
| AC-23 | As a release owner, I want CI to be check-only. | The CI browser-quality path contains no baseline-update invocation and fails if an ordinary check changes approved baseline bytes. | test |
| AC-24 | As a maintainer, I want discoverable local gates. | The root package command listing and project-runner target listing each expose separate compatibility, accessibility, visual-check, visual-update, and aggregate browser-quality commands with unambiguous names. | review |
| AC-25 | As a maintainer, I want one pre-push answer. | On a clean deterministic checkout with installed engines, the aggregate local command executes the full Chromium suite, bounded Firefox/WebKit matrix, accessibility scan, and visual check and exits zero. | test |
| AC-26 | As a maintainer, I want child failures preserved. | When any one constituent gate exits non-zero, the aggregate command also exits non-zero and identifies the failing gate class. | test |
| AC-27 | As a maintainer, I want hermetic browser checks. | With the backend and live vendor unavailable, deterministic compatibility, accessibility, and visual commands still execute their promised states rather than skipping them. | test |
| AC-28 | As a maintainer, I want missing prerequisites distinguished from product defects. | When a required browser engine is not installed, the invoked command exits non-zero with a remediation message and does not report any engine as passed. | test |
| AC-29 | As a reviewer, I want non-vacuous green evidence. | A successful aggregate summary reports non-zero executed counts by engine, accessibility-state family, and visual comparison family. | test |
| AC-30 | As a release owner, I want local and hosted behavior aligned. | Running the documented CI-mode command locally invokes the same check-only gate set as the ordinary aggregate command and never invokes visual updating. | test |
| AC-31 | As a release owner, I want hosted wiring ready without an invented pass. | The hosted workflow invokes the documented check-only aggregate command and is configured to retain compatibility, accessibility, and visual failure artifacts when execution occurs. | test |
| AC-32 | As a release owner, I want hosted status reported honestly. | While hosted runners are unavailable, the completion record says hosted execution is unavailable and does not use “passed,” “green,” or equivalent wording for hosted browser evidence. | review |
| AC-33 | As a security-conscious reviewer, I want safe evidence. | Scanning browser artifacts from successful and deliberately failing runs finds only synthetic fixture identities and no real credential, personal-account, or live-market secret. | test |

## Risks I see

- **False browser promise:** Playwright WebKit is useful engine evidence but is not every shipping Safari
  build. If policy copy collapses those meanings, the gate will overclaim support even while technically
  green.
- **Matrix creep:** tagging becomes useless if Firefox/WebKit gradually inherit the whole suite. The
  exact five-journey inventory is a product cost boundary and needs a failing over-collection check.
- **Vacuous green:** an empty selection, failed fixture, skipped scan, or absent baseline can otherwise
  read as zero failures. Every gate needs a positive execution count and a configuration-failure state.
- **Accessibility theater:** automated scanning misses keyboard sequence quality, screen-reader meaning,
  zoom/reflow behavior, and cognitive issues. The limitation must accompany every result, not live in an
  obscure disclaimer.
- **Existing severe finding:** the first representative scan may reveal a serious or critical issue that
  predates this feature. The brief forbids product UI change; quietly excluding or grandfathering it would
  defeat the gate, so that discovery must bounce through GATE Z.
- **Visual flake:** font readiness, animation, time, locale, viewport, or platform rendering can make
  identical product bytes look different. A gate that flakes will train maintainers to update baselines
  reflexively.
- **Baseline laundering:** a convenient update command can turn a regression into an approved image
  without understanding it. Check and update authority must remain visibly separate, and CI must be
  incapable of updating.
- **Cross-platform mismatch:** local Windows evidence and hosted Linux evidence may need separately
  approved expectations. A platform without an approved expectation must fail honestly; it must not
  silently borrow or generate one.
- **Artifact leakage:** traces and screenshots can capture credentials or account information if a test
  ever escapes synthetic fixtures. Evidence safety is part of the gate, not an afterthought.
- **Hosted-evidence ambiguity:** workflow wiring and local CI-mode execution are not proof that GitHub
  executed the gate. Until runners return, hosted status must remain explicitly unavailable.
- **Runtime-scope drift:** fixing gate failures by changing existing copy, styling, motion, or trader
  behavior would violate the brief. Any such need is a scope decision, not an incidental test change.

## Assumptions I'm making about the other two lanes

- The architecture lane can isolate the five cross-engine journeys so Firefox and WebKit cannot collect
  the remainder of the Chromium suite, while Chromium still collects every existing scenario.
- The architecture lane can make each named product state deterministic and synthetic without a running
  backend, live vendor, real account, wall-clock market state, or internet dependency after toolchain
  installation.
- The architecture lane can make ordinary visual checking byte-read-only and make baseline updating a
  separately invokable capability that the hosted workflow cannot reach accidentally.
- The architecture lane can produce stable visual comparisons on the supported local environment and on
  hosted Linux without silently sharing an incompatible platform baseline.
- The architecture lane can expose non-vacuous counts and actionable artifacts for all three gate classes
  without changing application runtime behavior.
- The UX/tech-writing lane can express the pinned-engine support boundary without calling Playwright
  WebKit “Safari certification” or responsive viewports “mobile-device testing.”
- The UX/tech-writing lane can identify existing readiness and state markers for every public,
  authenticated, dense, empty, cold-error, and stream-offline fixture without requiring new trader-
  visible copy or layout.
- The UX/tech-writing lane can keep the eight visual baselines focused on existing high-risk presentation
  and can define review guidance that distinguishes intentional drift from baseline-update convenience.
- The current in-scope representative states contain no pre-existing serious or critical automated
  accessibility violation; if that assumption is false, the no-UI-change guardrail requires GATE Z.
