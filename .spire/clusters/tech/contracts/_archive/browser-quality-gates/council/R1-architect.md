# R1 — architect position: browser-quality-gates

## Position

### Grounded starting point

The quality-gate boundary belongs in `apps/dashboard-e2e`, its Playwright configuration, the root
package/Nx command graph, and CI workflow only. The live repository has Playwright 1.62.1, five
Playwright spec files, one `chromium` project, an Nx project whose targets are currently plugin-inferred,
and a CI step that installs only Chromium before running `dashboard-e2e:e2e`. The current config already
owns the port-4200 web-server lifecycle, retries once in CI, and records a trace on first retry. Those are
the seams to extend. Application, shared client, API, scoring, and production runtime modules are outside
the feature boundary.

The present suite is useful but is not a deterministic fixture authority for the new gates: several
specs use wall-clock time and allow unmatched API requests to fall through. I would retain those 52
Chromium tests intact and put all new cross-engine, accessibility, and screenshot scenarios behind one
strict fixture harness. That harness owns browser state before application boot, intercepts every request
the scenario can issue, aborts an unexpected `/api` request, uses fixed instants instead of `Date.now()`,
and exposes a readiness barrier based on asserted page state rather than `networkidle` (the app has SSE).

### Supported-browser policy and its enforcement

Declare one first-party Browserslist policy at the workspace root for the current and previous stable
Chrome, Edge, Firefox, desktop Safari, and iOS Safari families, excluding dead/unsupported browsers. The
resolved set is lockfile-dependent through the checked dependency graph, so dependency review is also a
browser-policy review. A named policy check must resolve the query and fail when a required family
disappears or a forbidden legacy family enters; this turns the promise into executable data rather than a
comment.

Browserslist does **not** automatically drive the current Vite 8 `build.target: 'es2022'`. I would keep
that explicit Vite transform boundary and add a source-level consistency guard that fails if the
Browserslist declaration or Vite JavaScript/CSS target moves without the same reviewed policy change.
This is intentionally two named mechanisms with a drift detector, not a false claim of single-source
transpilation. If a reviewed Browserslist-to-Vite converter is adopted later, that can collapse the two;
adding a new conversion dependency now has higher supply-chain and debugging cost than this feature
needs.

The automated evidence promise must be narrower than the product support promise:

- Playwright's pinned Chromium, Firefox, and WebKit builds are the engines actually executed.
- Chromium is a useful proxy for Chrome/Edge, and WebKit is a useful compatibility proxy for Safari, but
  neither proves a specific installed Edge build, macOS Safari release, or iOS Safari device.
- Browserslist/build-target checks prove emitted-code intent, not behavioral correctness on every listed
  browser version.

Those distinctions belong in the gate receipt. A row that was configured but not executed is `not run`,
not pass; this applies `[absent-is-not-none]` to verification evidence.

### Browser matrix without suite multiplication

Keep the current Chromium project as the owner of the full existing suite. Add a closed, tagged journey
set that Chromium runs as part of its full suite and that Firefox and WebKit run through project-level
filtering. The bounded set should exercise five technical journeys: public boot, client-side routing,
content-full Ticker with an isolated stream loss, authenticated Positions with dense/expanded content,
and authenticated Scanner with dense responsive content. Each journey has a vacuity guard proving its
intended content/state mounted before compatibility assertions run.

This produces one full Chromium lane plus only the five journeys on each secondary engine. It does not
copy all 52 tests into two more projects. Compared with a full 52-by-3 matrix, the tagged matrix wins on
CI cost, triage complexity, and team familiarity; full multiplication adds roughly two suites of runtime
while making existing Chromium-specific failures harder to distinguish. Compared with one smoke test per
engine, five stateful journeys cost more but cover the browser boundaries this app actually depends on:
router history, local storage, CSS layout, focus/expand behavior, REST fixture rendering, and SSE
degradation. Expected scale is one frontend and a small stable journey set, so scalability does not
justify sharding in this feature.

Engine failures remain isolated by Playwright project. A Firefox failure must not prevent WebKit from
producing its own result/artifacts, but the aggregate gate fails if any required project fails or is
missing. Traces, console output, and the failing screenshot are retained per project so the engine and
journey are visible without rerunning locally.

### Automated accessibility gate

Use `@axe-core/playwright` in a Chromium-only accessibility project. Axe runs after the same strict
fixture/readiness boundary over a closed representative state matrix:

- anonymous public Landing;
- signed-in Settings;
- signed-in dense Positions with an expanded multi-leg/broker group;
- signed-in dense Scanner at its table and mobile-card bands;
- Ticker in a degraded stream state while its static bundle remains present.

The scan selects WCAG A/AA rule tags through WCAG 2.2 where axe provides them and fails the gate for
`serious` or `critical` violations. Moderate/minor findings remain attached to the run rather than being
silently discarded. Each attachment carries the axe rule, impact, affected targets, help reference, and
scenario identity. Axe is DOM/semantics oriented, so running it on all three engines adds cost with little
new signal; the secondary-engine journeys instead retain real keyboard and layout assertions where
engines differ.

Do not introduce a blanket selector exclusion or disabled rule. If a false positive is proven, the only
permitted suppression is an exact rule-and-target waiver with rationale, owner, and expiry; an expired or
non-matching waiver fails. A mutation probe must inject a known serious violation and prove the
accessibility target goes red, satisfying `[structural-over-prose-enforcement]` rather than trusting an
empty report. This gate is explicitly not a manual accessibility audit and does not certify screen-reader,
zoom, voice-control, or cognitive usability.

### Visual-regression boundary

Use Playwright-native `toHaveScreenshot`; do not add Storybook, Percy, Chromatic, or another renderer.
The native path wins on cost and team familiarity because Playwright and route fixtures already exist.
It also keeps browser behavior and visual capture in one failure artifact. Hosted visual services add an
account, upload boundary, ongoing spend, and a second fixture/render authority without a capability gap
for this small matrix.

Keep the baseline inventory closed and small: six viewport screenshots covering Landing desktop in both
schemes, content-full Ticker mobile in both schemes, dense Positions at the 900px risk band, and degraded
Scanner mobile in the opposite scheme. These are route-state captures, not a new design authority. A
manifest/set-equality test rejects a missing, orphaned, or unapproved baseline so adding a screenshot is a
reviewed inventory change.

Determinism works through the strict fixture harness plus a pinned clock, locale, New York timezone,
viewport, device scale factor, color scheme, reduced-motion setting, and Playwright browser revision.
Every capture waits for self-hosted fonts (`document.fonts.ready`) and scenario-specific content, uses
fixed fixture timestamps, stubs SSE deliberately, hides the caret, and disables animations for capture.
The capture-only animation control does not modify product motion and cannot authorize a new animation.
Start with zero pixel tolerance on the same platform identity. If repeat evidence shows unavoidable
raster noise, any tolerance change must cite measured repeated diffs; it must not be guessed.

Baseline identity includes scenario, viewport, scheme, Playwright project, and operating-system platform.
That avoids pretending a Windows-authored PNG is an Ubuntu rendering. A platform with no reviewed
baseline fails as missing under check mode. The check target forces Playwright's verified
`updateSnapshots: 'none'`, so it cannot create a baseline as a side effect. The update target uses the
deliberate update mode, runs uncached, and only changes the current platform's baseline candidates.
Review/commit authority for accepting changed images is a product-process decision for the PM lane; the
technical boundary is that CI never invokes update mode and a check run cannot write acceptance.

### Fixture and evidence data boundaries

The strict fixture module is the single authority for new quality scenarios. Its conceptual records are:

- a **scenario definition**: route, authentication state, durable-browser seed, network fixture profile,
  stream state, clock, and readiness assertion;
- a **coverage entry**: gate kind, engine, journey/state, viewport, scheme, and expected artifact class;
- a **run result**: executed/not-run distinction, pass/fail, environment identity, and artifact locations;
- a **baseline identity**: scenario plus rendering-environment dimensions, never a single cross-platform
  “golden”.

Scenario setup may seed the existing local-storage shapes before boot but never migrates, deletes, or
writes production user data. Quality specs must use fresh browser contexts, so a failed scenario cannot
contaminate the next scenario. Unexpected network access is a scenario failure, not a fallback to a live
backend. Browser-engine, accessibility, and visual failures are separate Playwright projects/output
directories so one category cannot overwrite another's evidence.

### Nx, npm, and CI command graph

Make the commands explicit in the `dashboard-e2e` Nx project instead of relying on one inferred target:

- `e2e` — the full Chromium suite, retaining today's meaning;
- `browser-compat` — the bounded Chromium/Firefox/WebKit journey matrix;
- `accessibility` — the representative axe matrix;
- `visual` — baseline check with snapshot updates disabled;
- `visual-update` — deliberate baseline candidate update, never a dependency of another target;
- `browser-quality` — aggregate check depending on policy, full Chromium, browser compatibility,
  accessibility, and visual check targets.

Expose one root npm check command that calls the aggregate Nx target and one unmistakably separate root
npm update command that calls only `visual-update`. All new browser-quality targets should be uncached:
the bounded runtime is acceptable, and a restored Nx success is not evidence that the installed browser
engines executed now. The update target is also non-parallel and uncached so two workers cannot race on a
baseline file. The existing full Chromium target may retain its current cache policy outside the
aggregate only if the aggregate invokes it with runtime evidence forced; otherwise the aggregate must
use an uncached full-suite wrapper.

CI installs all three pinned Playwright engines with system dependencies, then runs full Chromium,
compatibility, accessibility, and visual checks as separately named steps. Failure artifacts are uploaded
with `if: always()` from per-gate output directories, with a finite retention period and no secrets or
production payloads. The visual step only checks. No CI branch, retry, or missing-baseline path can call
the update target.

The current GitHub-hosted runner/billing unavailability is an evidence boundary, not a reason to omit CI
wiring. Local runs can prove the commands, engine matrix, axe failures, screenshot stability, and
mutation probes. Static inspection can prove the workflow invokes the check targets. Until an actual
hosted run completes, the receipt must say hosted execution `not run`; it must not claim hosted browser,
artifact-upload, Ubuntu baseline, or required-check evidence. When runners return, the first real run is
expected to fail if an Ubuntu baseline has not yet been deliberately reviewed, which is safer than
silently creating one.

### Restated binding constraints

- **`[structural-over-prose-enforcement]`:** Browserslist resolution, closed journey/baseline manifests,
  strict unmatched-request failure, update-disabled screenshot checks, and positive mutation probes make
  policy violations build-breaking.
- **`[theme-token-discipline]`:** tests consume the shipped dark/light theme and assert both schemes; they
  add no product colors, token table, or hardcoded visual “fix”. Screenshot baselines record output but do
  not supersede `DESIGN_SYSTEM.md` or `tokens.ts`.
- **`[single-motion-moment]`:** no runtime keyframe or motion behavior changes. Reduced motion and
  capture-time animation suppression are harness controls only; the existing motion inventory test stays
  authoritative.
- **`[absent-is-not-none]`:** configured, skipped, not-run, missing-artifact, pass, and fail remain
  distinct evidence states. A missing browser install, baseline, report, or hosted run cannot become a
  pass.
- **`[live-vs-static-isolation]`:** the degraded Ticker fixture must show static bundle content surviving
  an isolated SSE loss; fixture setup must not blank the page and accidentally turn a compatibility or
  accessibility test into an error-page test.
- **`[loss-free-durable-migration]`:** no production durable key or shape changes. Browser-context seeds
  are disposable copies; setup never deletes or promotes a real user's local storage.
- **`[operator-vs-trader-path-separation]`:** this feature adds no trader or operator route and makes no
  vendor/recompute/cache call. Reports are test-run artifacts outside application navigation.
- **`[cited-code-is-verified-not-assumed]`:** the design attaches only to inspected live seams:
  `package.json`, `nx.json`, `apps/dashboard-e2e/project.json`, its Playwright config/specs, the dashboard
  Vite config, and `.github/workflows/ci.yml`. Any executor-specific syntax not verified during planning
  must carry a lane check rather than be invented.

### Explicit non-goals

- No application UI, copy, theme, motion, API, backend, scoring, fingerprint, or durable-state change.
- No all-tests-by-all-engines matrix and no per-engine screenshot baselines beyond the one deliberately
  chosen visual project.
- No claim that axe is a complete WCAG audit, WebKit is Safari certification, Chromium is Edge
  certification, or desktop emulation is a mobile-device lab.
- No automatic baseline acceptance, snapshot update in CI, hosted visual service, or tolerance increase
  without repeat measurements.
- No hosted-run success claim while hosted runners remain unavailable.

## Risks I see

- A moving “last two stable” Browserslist policy can change when `caniuse-lite` changes even if application
  code does not. The lockfile and resolved-policy check make that visible, but dependency upgrades now
  require compatibility review.
- Vite target and Browserslist are separate mechanisms. The consistency guard prevents silent drift but
  cannot prove every emitted dependency behaves in every declared browser; real-device coverage remains a
  gap.
- Current e2e fixtures contain wall-clock values and network fallbacks. Reusing them directly would make
  screenshots and degraded-state tests flaky or network-dependent; the new gates need their own strict
  fixture boundary before any baseline is trusted.
- Firefox/WebKit can expose genuine differences in focus, font metrics, SVG/chart layout, and event
  behavior. The matrix must triage those as product incompatibility or explicit unsupported behavior;
  engine-specific skips would otherwise hollow out the gate.
- Zero-tolerance screenshot comparison may reveal platform/GPU/font raster noise. The response is repeated
  evidence and platform-specific baseline identity, not a broad diff threshold. This can make the first
  Ubuntu hosted run intentionally red.
- Accessibility rules can produce false positives or miss behavior that requires human judgment. Exact,
  expiring waivers constrain false-positive handling, but manual assistive-technology review remains
  outside this slice.
- Playwright/browser installation is a meaningful CI download and time cost. Separating the five-journey
  secondary matrix and Chromium-only axe/visual projects bounds it; a full multiplication would not.
- `if: always()` artifact upload can itself fail when a directory is absent. Each gate must create its
  output directory before execution or configure upload semantics that distinguish “gate never ran” from
  “gate ran with no failure artifact”.
- Hosted CI wiring cannot be runtime-verified under the current billing pause. Local evidence plus static
  workflow inspection is honest but incomplete until the first real hosted run.

## Assumptions I'm making about the other two lanes

- I assume PM will define the supported-browser promise as current/previous evergreen families rather
  than named historical version numbers; if false, the Browserslist query and evidence matrix need a
  fixed-version policy and likely a browser farm.
- I assume PM will accept serious/critical axe findings as the automated blocking threshold while
  moderate/minor findings remain recorded; if false, the failure classifier and expected triage volume
  change.
- I assume PM will choose a named human reviewer/owner as the only authority to accept changed visual
  baselines; if false, the deliberate update target has no safe acceptance process.
- I assume PM will accept the five cross-engine journeys and five accessibility state families as the
  representative risk boundary, rather than requiring every route/state on every engine; if false, CI
  cost and fixture scope increase materially.
- I assume PM will treat `configured but not hosted-run` as incomplete evidence rather than a release
  pass; if false, the evidence vocabulary would overclaim unavailable CI execution.
- I assume UX will identify stable semantic readiness anchors for each representative state without
  adding test-only trader-visible copy; if false, the harness needs non-visual readiness instrumentation.
- I assume UX will not use screenshot baselines to redefine layout, palette, copy, or motion and will
  defer to the existing design canon; if false, this feature becomes an unauthorized redesign.
- I assume UX will specify any manual accessibility checks that must accompany axe without claiming they
  are automated by this feature; if false, the acceptance boundary between automated and human evidence
  remains ambiguous.
- I assume UX will approve capture-time reduced motion/animation suppression as a test harness state, not
  as a change to the product's single allowed orchestrated motion; if false, the visual matrix needs a
  different stabilization mechanism.
