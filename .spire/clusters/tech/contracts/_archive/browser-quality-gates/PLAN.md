# browser-quality-gates — implementation plan

**Goal:** make Convexa's retained Chromium suite, bounded cross-engine compatibility journeys,
automated accessibility checks, and deterministic visual comparisons into one honest local and CI
quality gate, including only the owner-authorized D7 and D8 accessibility corrections, without changing
any backend/API surface or unrelated product behavior.

**Architecture:** keep the five existing specs as the full-Chromium tier, and add a separate
`apps/dashboard-e2e/src/quality/` boundary containing one closed manifest, strict synthetic fixtures,
state-readiness predicates, and compatibility/accessibility/visual specs. Quality-specific Playwright
configs select disjoint files and stable artifact roots; repository-owned reporters and validators
produce strict summaries. An uncached Node aggregate launches exactly four uncached Nx child targets on
separate loopback ports with direct argv and `Promise.allSettled`, then validates their receipts. Visual
candidate generation is a distinct receipt-authorized path that no check, aggregate, or merge workflow
can reach. D7 and D8 are later, sequential frontend repair slices: first correct the five diagnosed
fixture/oracle defects under `apps/dashboard-e2e`, then make the D7 product repairs, enforce that boundary,
and finally repair only the six D8 selector-tied findings with focused component and real-Chromium
regressions before the visual closer runs.

**Stack:** Node 24 built-ins and `node:test`; Nx 23.1.1 `nx:run-commands`; Playwright 1.62.1
(`@playwright/test` lock resolution and its Chromium 1234, Firefox 1538, WebKit 2336 engine records);
`@axe-core/playwright` 4.13.0 as an exact development dependency; TypeScript 5.9.3; GitHub Actions;
Playwright-native `toHaveScreenshot`. The current Vite build target remains `es2022`; it is emitted-code
intent, not browser-journey evidence.

## Global Constraints

- `NO_BACKEND_CHANGE` is absolute. `D7_D8_UI_CHANGE_LIMITED` permits edits only to the 25 product files
  named below and only for AC29–32 and AC40–45; AC33 is an e2e-oracle correction and does not authorize a
  product edit. Every other `apps/dashboard/src/**` path, all `apps/dashboard/public/**`, `libs/api/**`,
  `apps/api/**`, `libs/quant-engine/**`, routes, unrelated copy/style/semantics, layout, global theme
  tokens/palette, motion, scoring/fingerprint code, runtime dependency sections, data/state flow, API
  calls, and durable production keys/shapes remain forbidden. New packages are root development
  dependencies only.
- The complete D7 product allowlist is:
  `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx`;
  `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx`;
  `apps/dashboard/src/app/features/auth/SettingsPage.tsx`; and
  `apps/dashboard/src/app/shell/AppShell.tsx`. The diff guard must compare the exact set, not permit an
  `apps/dashboard/src/` prefix.
- The complete D8 product allowlist is:
  `apps/dashboard/src/app/pages/scanner/ScanCard.tsx`;
  `apps/dashboard/src/app/pages/scanner/ScanCells.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx`;
  `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx`;
  `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx`;
  `apps/dashboard/src/app/features/trading/positions/PlSparkline.tsx`;
  `apps/dashboard/src/app/features/trading/positions/CustomizationToolbar.tsx`;
  `apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx`;
  `apps/dashboard/src/app/features/trading/positions/PositionCard.tsx`;
  `apps/dashboard/src/app/features/trading/positions/LegDisclosure.tsx`;
  `apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx`;
  `apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx`;
  `apps/dashboard/src/app/features/auth/RequireAuth.tsx`;
  `apps/dashboard/src/app/features/auth/AuthDialogProvider.tsx`; and
  `apps/dashboard/src/app/features/auth/AuthDialog.tsx`. D8 additionally permits only the exact co-located
  test files owned by F9D, including the selector-tied evidence files
  `apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx` and
  `apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx`, plus the existing
  compatibility/accessibility specs. No directory-prefix allowlist is valid.
- Preserve the current five full-suite files and their 52 identities. Their bodies may not be moved into
  the quality directory, and compatibility-only specs may not be collected by the full suite. Freeze the
  actual inventory reported by `npx playwright test --config apps/dashboard-e2e/playwright.config.ts
  --list` before changing configuration.
- Every new browser scenario uses a fresh context, a fixed synthetic identity, fixed clock/locale/time
  zone/device scale/viewport/scheme, and a strict request dispatcher. An unrecognized `/api`, SSE, or
  external request aborts and fails; no quality scenario calls a real backend, vendor, account, market,
  internet service, or wall clock.
- Closed inventory equality is exact: 52 full Chromium identities, 5 compatibility journeys × 3 engine
  arms, 9 axe scan states, 7 non-axe A11Y-B sequences, and 6 Chromium visual scenarios. Missing,
  duplicate, zero, skipped, blank, surplus, wrong-state, or configured-but-unexecuted work is failure.
- Check paths set Playwright `updateSnapshots: "none"`. Only `dashboard-e2e:visual-update`, through the
  authorization validator, may set the private update environment and write current-platform PNGs.
  Neither direct npm/Nx argument forwarding nor the aggregate accepts an update flag.
- Platform baseline identity is `{platform}/{projectName}/{arg}{ext}` through Playwright 1.62.1's
  source-verified `snapshotPathTemplate` token set. Windows and Linux bytes never substitute for one
  another. Pixel tolerance is exactly zero; masks are absent unless a later approved amendment names one
  exact out-of-scope field.
- Human decisions are not builder output. A worker or command must never author or alter authorization or
  acceptance receipts. The conductor supplies an owner/design-review authorization after failed-compare
  review and a code-review acceptance/rejection after candidate/source-diff review. Missing authority is a
  visible stop before baseline acceptance, not permission to self-approve.
- Preserve absence states: blocked, not-run, zero-selected, failed, incomplete, flaky, candidate-written,
  rejected, accepted, and stability-clean never collapse into pass. CI retry-only success is failure;
  visual stability comparisons always use zero retries.
- The aggregate owns exactly four quality children. It may assign each a distinct loopback port so their
  Playwright web servers do not race, but it may not add a fifth quality child, replay a child, call visual
  update, or rely on Nx task-bail behavior.
- Hosted configuration is inspectable, but until a real hosted run exists its status remains exactly
  `[NOT RUN] hosted browser quality — hosted-runner evidence is unavailable. Local results do not count as hosted evidence.`
  Local execution never becomes hosted proof.
- Before each task, record `git status --short`; inspect only task-owned diffs; do not restore, stage, or
  overwrite unrelated dirty-workspace changes. Mutation tests use copies under an OS temporary directory
  and prove restoration by hash. If a live selector, endpoint, runtime module, or policy premise differs
  from the approved spec, stop at GATE Z instead of weakening the criterion.
- Each task follows red → green → review → commit. Run the named focused test and observe non-zero before
  implementation, make the smallest change, run it green, run `git diff --check`, inspect the exact path
  list, and commit with the task's stated message. Do not combine tasks into one unreviewable commit.
- F0–F9 remain the original tooling tranche. Repair tasks F9A → F9B → F9C → F9D are strictly
  sequential because they edit tests and guards first created by F1/F4/F5/F9. A test-fixture failure is
  repaired only under `apps/dashboard-e2e`; a product oracle is repaired only in the exact D7/D8 product
  allowlist. F9D does not add a journey, scan, screenshot, waiver, threshold, tolerance, token, or runtime
  dependency. If one repair appears to require crossing that division, stop at GATE Z.

## Conformance spec

```json
{
  "endpoints": []
}
```

The empty endpoint set is intentional and machine-checkable: conformance for this feature is that no backend contract is introduced. Runtime browser scenarios validate their synthetic fixture boundary under `SPEC.md`; they are not live API conformance tests.

## Backend track — intentionally empty

There are no backend tasks and no backend closer. The empty conformance surface above and the forbidden
path checks in F9/V9 enforce `NO_BACKEND_CHANGE`; browser scenarios replace network boundaries and do not
start or call the API. If implementation requires a backend endpoint, payload amendment, auth behavior, or
live fixture, the frontend/tooling lane stops at GATE Z.

## Frontend and repository/tooling track

### F0 — Freeze policy, build intent, dependencies, and all closed inventories

**Files:** `apps/dashboard-e2e/src/quality/manifest.json`;
`apps/dashboard-e2e/tools/lib/manifest.mjs`; `apps/dashboard-e2e/tools/manifest.spec.mjs`;
`apps/dashboard-e2e/tools/browser-policy.spec.mjs`; `apps/dashboard-e2e/README.md`; `package.json`;
`package-lock.json`.

1. Capture the unmodified suite with:

   ```powershell
   npx playwright test --config apps/dashboard-e2e/playwright.config.ts --list |
     Set-Content -LiteralPath $env:TEMP\browser-quality-pre-feature-list.txt
   ```

   The observed source seam is 52 tests in exactly
   `app-loads.spec.ts`, `broker-grouping.spec.ts`, `broker.spec.ts`, `navigation.spec.ts`, and
   `no-overflow.spec.ts`. Convert every listed record to
   `test_id = sha256("pre-feature-52-v1\0" + posix_file + "\0" + title_path.join("\0"))`, storing the
   lowercase 64-hex ID, repository-relative file, ordered title path, and project `chromium`. Check in the
   52 explicit records; do not regenerate them at runtime or infer them from artifact paths.
2. First write 20 failing `node:test` cases in `manifest.spec.mjs` for exact counts and IDs; duplicate,
   missing, surplus, zero, blank, or re-ordered identities; full/compat file-selection overlap; 5×3 engine
   arms; nine scans; seven A11Y-B IDs; six visuals; artifact-root set equality; supported engine set; and
   the exact Playwright lock version/revisions. Run
   `node --test apps/dashboard-e2e/tools/manifest.spec.mjs` and require non-zero.
3. Make `manifest.json` a strict object with this closed top-level shape; every child record carries the
   full scenario details from SPEC §4 rather than only a display label:

   ```json
   {
     "schema_version": 1,
     "support_policy_id": "playwright-engines-1.62.1",
     "full_chromium": { "inventory_id": "pre-feature-52-v1", "tests": [] },
     "compatibility": { "journeys": [], "projects": ["chromium", "firefox", "webkit"] },
     "accessibility": { "scans": [], "behaviors": [], "waiver_path": "apps/dashboard-e2e/src/quality/a11y-waivers.json" },
     "visual": { "scenarios": [], "project": "chromium", "threshold": 0 },
     "artifact_roots": {
       "chromium": "apps/dashboard-e2e/test-output/playwright/chromium",
       "compatibility": "apps/dashboard-e2e/test-output/playwright/compatibility",
       "accessibility": "apps/dashboard-e2e/test-output/playwright/accessibility",
       "visual": "apps/dashboard-e2e/test-output/playwright/visual"
     }
   }
   ```

   `loadManifest()` rejects unknown keys, unsafe IDs/paths, non-POSIX paths, `..`, duplicate arrays, and
   any set/count drift. The five journey records are the exact Landing/Ticker navigation, Ticker
   stream-loss, signed-out auth-dialog, dense Positions, and dense Scanner contracts. The nine readiness
   records copy every positive and forbidden predicate from SPEC §4, including explicit
   `[data-testid="command-deck"]` and `[data-testid="widget-bento"]` in A11Y-9/B6. The visual records copy
   all six exact route/state/viewport/scheme tuples.
4. Add exact `@axe-core/playwright@4.13.0` with
   `npm install --save-dev --save-exact @axe-core/playwright@4.13.0`; retain the locked Playwright
   resolution `1.62.1`. No runtime dependency changes are allowed.
5. In `browser-policy.spec.mjs`, source-check `apps/dashboard/vite.config.mts` and assert its live build
   target remains exactly `es2022`; assert there is no `.browserslistrc`, `browserslist` package key, or
   Browserslist-fed Vite transform. `README.md` must label `es2022` as emitted-code intent only and say a
   future Browserslist declaration would also be build intent, never behavioral evidence. This avoids
   inventing a second unsupported browser matrix while still making Browserslist/build intent explicit.
6. Write `apps/dashboard-e2e/README.md` with the exact tested-engine paragraph from SPEC §4, the full/
   bounded coverage split, declined branded-browser/all-version/OS/device/responsive-as-device/AT claims,
   locked-Playwright-upgrade review event, current `NOT RUN` line, six commands, artifact roots, and a link
   to the visual-review policy added by F6. Run both test files green and commit
   `test(e2e): freeze browser quality inventories and policy`.

**Reviewer probes:** delete one of the 52 rows; add Settings as a sixth journey; change WebKit's revision;
add a `.browserslistrc`; or describe `es2022` as a tested browser. Each probe must fail a named test.

### F1 — Build the strict fixture, state-readiness, and fresh-context boundary

**Files:** `apps/dashboard-e2e/src/quality/fixtures/data.ts`;
`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`;
`apps/dashboard-e2e/src/quality/fixtures/strict-fixture.ts`;
`apps/dashboard-e2e/src/quality/readiness.ts`;
`apps/dashboard-e2e/src/quality/fixture-contract.spec.ts`;
`apps/dashboard-e2e/tools/fixture-contract.spec.mjs`.

1. Write 24 red pure tests covering exact method/path dispatch; signed-in/out auth; bundle success then
   SSE payload-gap; cold failure; dense/empty/degraded scanner; dense multi-leg Positions; produced AI
   decision; localStorage seed isolation; fixed time; external-host denial; unexpected REST/SSE abort;
   no `route.fallback`; scenario completeness; and readiness non-vacuity. Add 18 table-driven poison arms
   (one required positive and one forbidden predicate for every A11Y-1…9 row). Run the Node test and the
   Playwright collection test; both must fail before implementation.
2. Define one `Scenario` record per manifest identity. It contains exactly:

   ```ts
   type Scenario = {
     id: string;
     route: string;
     auth: 'anonymous' | 'authenticated';
     durableSeed: Readonly<Record<string, unknown>>;
     rest: Readonly<Record<`${'GET' | 'POST'} ${string}`, FixtureResponse>>;
     stream: 'none' | 'connected' | 'payload-gap';
     now: '2026-08-23T16:00:00.000Z';
     locale: 'en-US';
     timezoneId: 'UTC';
     viewport: { width: number; height: number };
     colorScheme: 'dark' | 'light';
     deviceScaleFactor: 1;
     reducedMotion: 'reduce';
     ready: ReadonlyArray<Predicate>;
     forbidden: ReadonlyArray<Predicate>;
   };
   ```

   Reuse the source-read payload shapes in current `no-overflow.spec.ts` (`bundle`, `scan`, produced rec,
   `SEEDED_POSITIONS`, `CONDOR`) and current broker specs, but give quality fixtures fixed timestamps and
   synthetic `.invalid` identities. Do not import production modules or alter the existing 52 specs.
3. Extend Playwright's base fixture so every test gets a fresh context and calls
   `page.clock.install({ time: new Date(scenario.now) })` before navigation. `addInitScript` writes only
   disposable `convexa.uiprefs.v1`, positions, and explicitly declared test seeds. Register one
   `context.route('**/*')` dispatcher: same-origin static assets continue, an exact declared REST/SSE arm
   fulfills, and every other `/api`, SSE, or non-loopback host records the request then calls
   `route.abort('blockedbyclient')`. Fixture teardown fails when the unexpected list is non-empty. There is
   no `fallback()` branch.
4. Implement `assertReady(page, record)` to require every positive predicate and require zero matches for
   every forbidden predicate before an axe scan, journey assertion, or screenshot. Reject empty predicate
   arrays. Do not use `networkidle`; after ready, visual callers separately await
   `document.fonts.ready`.
5. Run 24/24 pure tests, all 18 readiness poison cases, and `npx nx run dashboard-e2e:typecheck`. Commit
   `test(e2e): add hermetic browser scenario fixtures`.

**Reviewer probes:** replace the default abort with fallback, omit one A11Y-7 forbidden selector, poison
one required anchor, or seed a real durable key outside the declared map. Each must fail before a browser
can report a clean scan.

### F2 — Add strict summary schemas, artifact hashing, and the gate reporter

**Files:** `apps/dashboard-e2e/src/quality/reporters/quality-reporter.ts`;
`apps/dashboard-e2e/tools/lib/summary.mjs`;
`apps/dashboard-e2e/tools/lib/runtime-identity.mjs`;
`apps/dashboard-e2e/tools/lib/fs-safe.mjs`;
`apps/dashboard-e2e/tools/summary.spec.mjs`.

1. Write 20 red Node tests for strict unknown-key rejection; common fields; full 52-test identity schema;
   compatibility engine/journey records; accessibility surface/state/finding records; visual
   scenario/platform/baseline records; SHA-256 calculation; repository-relative resolved artifact paths;
   source/run mismatch; zero selection; selected/executed arithmetic; flaky status; missing artifacts;
   browser revision mapping; atomic writes; safe path boundaries; and status precedence
   `incomplete > fail > pass`.
2. Implement a single validator that requires the common child shape:

   ```js
   {
     schema_version: 1, gate, run_id, source_revision,
     selected, executed, passed, failed, flaky, not_run, status,
     playwright_version, browser_revision, host_platform,
     artifacts: [{ path, sha256 }]
   }
   ```

   Gate additions are exact: Chromium adds `inventory_id`, `project`, and 52 `tests[]`; compatibility adds
   15 `arms[]`; accessibility adds nine `scans[]`, seven `behaviors[]`, and all `findings[]`; visual adds
   six `scenarios[]`. `selected = passed + failed + flaky + not_run`; `executed = passed + failed + flaky`;
   `flaky > 0`, `not_run > 0`, zero selection, or an absent/hash-mismatched required artifact prevents
   pass.
3. Read Playwright version from the resolved package and engine revisions from the installed
   `playwright-core/browsers.json`, applying its platform override when present. Do not call a branded
   browser or infer engine identity from a user agent.
4. Implement the reporter with `onBegin` inventory validation, `onTestEnd` identity/status/attachment
   collection, and `onEnd` atomic summary write. It prints the exact §4 RUNNING/PASS/FAIL/BLOCKED wording,
   overrides a would-be Playwright pass when inventory/artifact/flake validation fails, and never emits a
   banned claim (`all browsers supported`, `browser unsupported`, `WCAG compliant`, `accessible`,
   `pixel perfect`, `verified`, `approved`). Hash resolved attachments after Playwright closes them.
5. Run 20/20 and typecheck green. Commit `test(e2e): add strict browser gate receipts`.

**Reviewer probes:** delete an attachment after recording it, set executed to zero, change the source SHA,
or mark a retry-only test passed. The validator must refuse pass.

### F3 — Make the retained 52-test Chromium target explicit and self-identifying

**Files:** `apps/dashboard-e2e/playwright.shared.config.ts`;
`apps/dashboard-e2e/playwright.config.ts`; `apps/dashboard-e2e/tools/run-gate.mjs`;
`apps/dashboard-e2e/tools/chromium-inventory.spec.mjs`.

1. Write 12 red structural tests that run Playwright `--list` and compare the exact 52 ID set; reject any
   quality spec in collection; require only project `chromium`; require uncached wrapper execution;
   `failOnFlakyTests:true`; stable chromium artifact root; exact reporter; current five files; no update
   mode; no `networkidle`; browser/app BLOCKED copy; and no live backend command.
2. Extract only configuration, not tests, into `playwright.shared.config.ts`. Its executable shape is:

   ```ts
   export function sharedConfig(gate: Gate) {
     const port = Number(process.env.BROWSER_QUALITY_PORT ?? 4200);
     const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;
     return {
       fullyParallel: true,
       forbidOnly: Boolean(process.env.CI),
       failOnFlakyTests: true,
       retries: process.env.CI ? 1 : 0,
       use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
       webServer: {
         command: process.env.CI
           ? `npx nx run @convexa/dashboard:serve-static --port=${port}`
           : `npx nx run @convexa/dashboard:serve --port=${port}`,
         url: baseURL, reuseExistingServer: false, cwd: workspaceRoot, timeout: 180_000,
       },
     } as const;
   }
   ```

   Aggregate-assigned ports are 4210–4213; direct targets default to the current port 4200.
3. Keep `playwright.config.ts` at `testDir:'./src/e2e'`, explicit `testMatch` set-equal to the current five
   spec filenames, and one Chromium `Desktop Chrome` project. Add the quality reporter targeting
   `test-output/playwright/chromium/summary.json`; do not alter the five spec bodies.
4. `run-gate.mjs chromium` removes only the chromium artifact root, preflights the locked Chromium
   executable, supplies a generated run ID/current 40-hex revision when the aggregate did not, then direct-
   spawns local `playwright` with `shell:false`. A missing engine prints the exact install command; a web
   server startup failure prints the exact dashboard BLOCKED line. It never accepts arbitrary forwarded
   arguments or an update option.
5. Run 12/12, `npm run browser:chromium -- --list` after F8 wiring, then the real run expecting 52/52 and
   a manifest-equal summary. Commit `test(e2e): retain explicit chromium inventory`.

**Reviewer probes:** rename one title, broaden `testMatch`, add Firefox to the base config, or set retries
without `failOnFlakyTests`. Collection/structure must fail.

### F4 — Implement the five-journey × three-engine compatibility tier

**Files:** `apps/dashboard-e2e/playwright.compat.config.ts`;
`apps/dashboard-e2e/src/quality/compatibility.spec.ts`;
`apps/dashboard-e2e/tools/compatibility.spec.mjs`.

1. Write 15 red structural/integration controls: exact five journey IDs in Chromium, Firefox, and WebKit;
   state anchor before load-bearing assertions; SPA sentinel and Back/Forward/parameter binding; static
   bundle retention after isolated SSE loss; signed-out wall/dialog keyboard close/focus return; dense
   Positions expansion/navigation at 393×852; Scanner table/card/degraded/navigation; one poisoned arm
   localized; other arms settle; trace/screenshot retained; no Settings journey; no full-suite file; no
   branded/unsupported wording; and manifest equality.
2. Configure exactly three projects using the installed source-verified devices:

   ```ts
   projects: [
     { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
     { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
     { name: 'webkit', use: { ...devices['Desktop Safari'] } },
   ],
   testDir: './src/quality',
   testMatch: 'compatibility.spec.ts'
   ```

3. Parameterize only the five manifest journeys; each test first calls `assertReady`, then the exact §4
   journey oracle. Annotate every result with its journey ID and project so the reporter writes 15 unique
   `{engine,journey_id,status,artifact_paths}` arms. A deliberate fixture poison may target one execution
   key only; it must not change selection or short-circuit siblings.
4. Run 15/15 controls, `--list` expecting 15, then the installed-engine tier expecting 15/15. Commit
   `test(e2e): add bounded cross-engine journeys`.

**Reviewer probes:** add a sixth journey, collect `src/e2e`, remove the state anchor, or convert an
engine-specific failure to “browser unsupported.” Each must fail.

### F5 — Implement the nine axe scans, seven behavioral sequences, and narrow waivers

**Files:** `apps/dashboard-e2e/playwright.a11y.config.ts`;
`apps/dashboard-e2e/src/quality/accessibility.spec.ts`;
`apps/dashboard-e2e/src/quality/a11y-waivers.json`;
`apps/dashboard-e2e/src/quality/a11y.ts`;
`apps/dashboard-e2e/tools/a11y-policy.spec.mjs`.

1. Create `a11y-waivers.json` as `[]`. Write 35 red tests for exactly nine Chromium scans and seven
   A11Y-B sequences; all 18 readiness poisons; serious/critical negative control; moderate/minor retained
   control; exact finding fields; scope disclaimer; and waiver mutations for ID/type/rule/selector/
   evidence/rationale/owner/removal condition/expiry/path/duplicate/broad match. A valid waiver type is
   only `axe_false_positive` or `third_party_uncontrolled`, and expiry must be a future RFC3339 UTC time.
2. Run `new AxeBuilder({ page }).analyze()` only after `assertReady`. Preserve every violation/node as:

   ```ts
   { scan_id, route, state, rule_id, impact, help_url, target_selector,
     waived: boolean, waiver_id: string | null }
   ```

   Apply validated waivers after analysis by exact rule and exact normalized target selector; do not call
   broad Axe `exclude`. Any unwaived `serious`/`critical` makes the test and gate fail. `moderate`/`minor`
   remains in JSON and alone does not fail. Print the exact threshold-failure and manual-audit disclaimer.
3. Implement A11Y-B1…B7 literally from SPEC §4. Use real keyboard traversal and `:focus-visible`; verify
   alert/live strings exactly; use bounding-rectangle intersection with `visualViewport`; use a Chromium
   CDP session `Emulation.setPageScaleFactor({ pageScaleFactor: 2 })` and first assert
   `visualViewport.scale === 2`; separately assert `innerWidth === 393` and no horizontal overflow. Verify
   the reduced-motion hero class/computed animation and all degraded non-colour text/icons.
4. Configure one Chromium project, `testMatch:'accessibility.spec.ts'`, stable accessibility summary root,
   and no snapshot-update surface. `--list` must report 16 tests: nine scan tests plus seven behavior tests;
   the receipt separately records exact 9/7 inventory equality.
5. Run 35/35 policy/mutation tests and the real 16/16 browser tier. Commit
   `test(e2e): gate accessibility states with axe and behavior`.

**Reviewer probes:** delete an A11Y-B step, let wrong-state axe run, hide a serious result, drop a moderate
artifact, or add an unowned/broad waiver. Each must make the gate non-zero.

### F6 — Implement deterministic visual comparison and receipt-bound candidate review

**Files:** `apps/dashboard-e2e/playwright.visual.config.ts`;
`apps/dashboard-e2e/src/quality/visual.spec.ts`;
`apps/dashboard-e2e/src/quality/snapshots/**`;
`apps/dashboard-e2e/tools/visual-update.mjs`;
`apps/dashboard-e2e/tools/lib/visual-review.mjs`;
`apps/dashboard-e2e/tools/visual-review.spec.mjs`;
`apps/dashboard-e2e/visual-review/README.md`;
`apps/dashboard-e2e/visual-review/schemas/authorization.schema.json`;
`apps/dashboard-e2e/visual-review/schemas/candidate-set.schema.json`;
`apps/dashboard-e2e/visual-review/schemas/acceptance.schema.json`.

1. Write 42 red pure/subprocess tests covering all required authorization, candidate, and acceptance
   fields; exact keys; identifier grammar; actor roles; state/decision pair; 40-hex revision; win32/linux;
   RFC3339 UTC; safe POSIX paths; current platform; six-scenario equality; missing/duplicate/surplus rows;
   expected/diff nullable only for missing-baseline evidence; every required SHA; hash mismatch; stale
   source; changed product/fixture/manifest/config/baseline since source; authorization reuse; transition
   order; rejected acceptance; changed PNG/diff; command-created human receipt; missing/mismatched
   baseline; zero tolerance; no-write check; and two distinct zero-retry unchanged comparisons.
2. Configure Chromium only, retries `0`, `updateSnapshots:'none'` unless the private exact environment
   `BROWSER_QUALITY_AUTHORIZED_UPDATE=1` is set by `visual-update.mjs`, and:

   ```ts
   snapshotPathTemplate:
     '{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}',
   expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', threshold: 0,
     maxDiffPixels: 0, maxDiffPixelRatio: 0 } }
   ```

   Structural tests reject CLI override forwarding and any other setter of the private environment.
3. Parameterize exactly six manifest cases. For each, install the fixed scenario, assert readiness, await
   `document.fonts.ready`, assert locale/timezone/viewport/device-scale/scheme/reduced-motion preconditions,
   fixture-fix volatile text, and call `expect(page).toHaveScreenshot(`${scenario.id}.png`)`. Do not wait
   for `networkidle`, add masks, or modify product CSS; animation/caret suppression stays capture-only.
4. Implement strict receipt validators matching SPEC §2 exactly. `visual-update.mjs` accepts only
   `--authorization <repo-relative-json>`, validates the failed compare summary and all six artifact
   hashes, verifies source-diff since `source_revision` contains only that authorization file, records
   pre-run hashes of authorization/acceptance directories, sets the private environment, direct-spawns
   Playwright with `shell:false`, and then verifies exactly six current-platform PNG writes. It atomically
   writes only the `candidates_written` receipt and proves human-decision directories unchanged.
5. Derive `candidate_set_id` deterministically from authorization ID + manifest hash + ordered candidate
   hashes so reusing an authorization cannot create a second set. The generated receipt contains exactly
   the schema in SPEC §2. Provide a validator command for an externally authored acceptance and
   `validateStability(acceptance, [summary1, summary2])`; it prints `stability_clean` only for two distinct
   run IDs at the same source/platform, zero retries/flakes, and unchanged accepted PNG hashes. It does not
   author a stability or acceptance file.
6. `visual-review/README.md` documents `compare_failed → authorized → candidates_written →
   accepted|rejected → stability_clean`, exact actor boundaries, failed evidence review, source-diff path,
   Windows/Linux separation, manual Linux workflow handoff, and that candidate generation is not approval.
7. Run 42/42 green. Run compare with a deliberately missing baseline and a changed pixel in a temporary
   copied snapshot root; both must fail and leave expected bytes unchanged while retaining actual/diff.
   Commit tooling as `test(e2e): enforce visual review authority`. Accepted baseline bytes and human
   receipts are deliberately deferred to the F10 closer after external review.

**Reviewer probes:** set update mode in the check config, omit one hash, use an owner as code reviewer,
escape a path, accept before generation, alter a PNG after acceptance, or reuse one compare summary twice.
Every probe must fail without writing.

### F7 — Build the cross-platform all-settled aggregate and child publication validators

**Files:** `apps/dashboard-e2e/tools/run-quality.mjs`;
`apps/dashboard-e2e/tools/lib/process.mjs`;
`apps/dashboard-e2e/tools/lib/aggregate.mjs`;
`apps/dashboard-e2e/tools/validate-publication.mjs`;
`apps/dashboard-e2e/tools/run-quality.spec.mjs`.

1. Write 18 red Node/subprocess tests for exact four-child set and order; duplicate/fifth rejection;
   Windows `npx.cmd`/non-Windows `npx`; exact argv; `shell:false`; all four promises created before await;
   `Promise.allSettled`; exactly-once execution keys; distinct ports/artifact roots; sibling completion
   after spawn rejection/non-zero; no replay; visual-update unreachability; source/run mismatch; zero
   child counts; invalid/missing summary; artifact hash mismatch; and aggregate write only after settlement.
2. Freeze this only child catalog:

   ```js
   const CHILDREN = Object.freeze([
     { target: 'dashboard-e2e:e2e', gate: 'chromium', port: 4210 },
     { target: 'dashboard-e2e:compat', gate: 'compatibility', port: 4211 },
     { target: 'dashboard-e2e:a11y', gate: 'accessibility', port: 4212 },
     { target: 'dashboard-e2e:visual', gate: 'visual', port: 4213 },
   ]);
   ```

   Reject all CLI arguments. Resolve a 40-hex `git rev-parse HEAD`, create one safe run ID, then construct
   all spawn promises before `await Promise.allSettled(promises)`. Spawn `npx.cmd` on win32 and `npx`
   elsewhere with `['nx','run',target,'--skip-nx-cache']`, `shell:false`, inherited stdio, and env
   `NX_DAEMON=false`, `BROWSER_QUALITY_RUN_ID`, `BROWSER_QUALITY_SOURCE_REVISION`, plus that child's
   `BROWSER_QUALITY_PORT`/`BASE_URL`.
3. After every child settles, validate its exact stable summary and artifact hashes. Emit the aggregate:

   ```js
   {
     schema_version: 1, gate: 'quality', run_id, source_revision,
     started_at, completed_at, status,
     children: [{ target, execution_key: `${run_id}:${target}`, invocation_count: 1,
       exit_code, summary_path, summary_sha256, status }]
   }
   ```

   `children.length` is exactly four. Spawn errors use a non-zero/null-safe failure record; status is never
   pass when any child exit/summary/artifact/count is wrong. Write
   `test-output/playwright/quality/summary.json` only after settlement.
4. `validate-publication.mjs <gate>` accepts only the four gate names and checks the summary plus every
   listed artifact; it does not run Nx/Playwright. Run 18/18 and subprocess poisons green. Commit
   `test(e2e): aggregate browser gates without task bail`.

**Reviewer probes:** make the first child fail immediately, delete another summary, add visual-update to
the catalog, or set `shell:true`. All siblings must still run once and aggregate must fail after settlement.

### F8 — Wire exact Nx/npm targets and check-only hosted/manual workflows

**Files:** `apps/dashboard-e2e/project.json`; `package.json`; `.github/workflows/ci.yml`;
`.github/workflows/browser-visual-linux-candidates.yml`;
`apps/dashboard-e2e/tools/wiring.spec.mjs`.

1. Write 16 red structural tests for six exact Nx/npm mappings; all targets uncached; visual update
   `parallelism:false`; quality's sole command/no `dependsOn`; root command intent; check argument refusal;
   CI three-engine install; one aggregate invocation; no direct constituent/update calls; four distinct
   always uploads with `if-no-files-found:error`; manual workflow only `workflow_dispatch`; exact source
   revision + authorization path inputs; protected `visual-baseline-candidate` environment; contents-read
   permission; authorized update only; exact upload; no commit/push; and graph-unreachability from checks.
2. Replace the currently empty explicit target map (while retaining Nx project metadata) with exact
   `nx:run-commands` records. All use workspace-root commands, `cache:false`, and
   `forwardAllArgs:false`; `visual-update` also has target-level `parallelism:false`:

   ```json
   {
     "e2e": { "executor": "nx:run-commands", "options": { "command": "node apps/dashboard-e2e/tools/run-gate.mjs chromium", "forwardAllArgs": false }, "cache": false },
     "compat": { "executor": "nx:run-commands", "options": { "command": "node apps/dashboard-e2e/tools/run-gate.mjs compatibility", "forwardAllArgs": false }, "cache": false },
     "a11y": { "executor": "nx:run-commands", "options": { "command": "node apps/dashboard-e2e/tools/run-gate.mjs accessibility", "forwardAllArgs": false }, "cache": false },
     "visual": { "executor": "nx:run-commands", "options": { "command": "node apps/dashboard-e2e/tools/run-gate.mjs visual", "forwardAllArgs": false }, "cache": false },
     "visual-update": { "executor": "nx:run-commands", "options": { "command": "node apps/dashboard-e2e/tools/visual-update.mjs", "forwardAllArgs": true }, "cache": false, "parallelism": false },
     "quality": { "executor": "nx:run-commands", "options": { "command": "node apps/dashboard-e2e/tools/run-quality.mjs", "forwardAllArgs": false }, "cache": false, "dependsOn": [] }
   }
   ```

   `visual-update` forwards only so its validator can receive the one `--authorization` pair; the script
   rejects everything else.
3. Add the six root scripts exactly:

   ```json
   "browser:chromium": "nx run dashboard-e2e:e2e --skip-nx-cache",
   "browser:compat": "nx run dashboard-e2e:compat --skip-nx-cache",
   "browser:a11y": "nx run dashboard-e2e:a11y --skip-nx-cache",
   "browser:visual": "nx run dashboard-e2e:visual --skip-nx-cache",
   "browser:visual:update": "nx run dashboard-e2e:visual-update --skip-nx-cache",
   "browser:quality": "nx run dashboard-e2e:quality --skip-nx-cache"
   ```

4. In `ci.yml`, replace the Chromium-only install/run with `node --test apps/dashboard-e2e/tools/*.spec.mjs`,
   `npx playwright install --with-deps chromium firefox webkit`, and exactly one `npm run browser:quality`. Add four `if: always()` upload-artifact steps
   for the exact child roots; they have distinct names, retention 7, and `if-no-files-found:error`. No step
   reconstructs evidence or calls a child directly.
5. Add the manual Linux candidate workflow with only `workflow_dispatch`, required 40-hex
   `source_revision` and authorization path inputs, job environment `visual-baseline-candidate`, top-level
   `permissions: { contents: read }`, checkout with `persist-credentials:false`, npm ci, Chromium install,
   the exact authorized update command, and one upload of six Linux PNGs plus candidate-set receipt. It has
   no PR/push trigger, aggregate/check status, write permission, git commit, or push.
6. Run 16/16, `npx nx show project dashboard-e2e --json` (six explicit targets present, each uncached),
   and `npm run format:check`. Commit `ci(e2e): wire check-only browser quality gates`.

**Reviewer probes:** directly invoke compat in CI, add `--update-snapshots` to a check, add a push trigger
or contents-write to the candidate workflow, or add a fifth upload root. Each must fail structurally.

### F9 — Add mutation coverage, artifact secret scanning, and forbidden-diff enforcement

**Files:** `apps/dashboard-e2e/tools/mutations.spec.mjs`;
`apps/dashboard-e2e/tools/isolation.spec.mjs`;
`apps/dashboard-e2e/tools/artifact-safety.spec.mjs`.

1. Write 12 top-level tests that create OS-temporary copies and run the production validators against:
   inventory deletion/duplication; unexpected REST and SSE; readiness positive/forbidden poisons; serious
   axe injection; moderate axe retention; missing baseline; changed pixel; stale authorization; changed
   candidate hash; aggregate first-child failure; and update reachability. Require each poison to fail,
   then hash-restore the copied fixture and require the positive control to pass.
2. Artifact safety recursively scans successful and deliberately failing artifact roots. Allow only the
   manifest's synthetic IDs/domains/fixtures; reject environment values matching credential/token/key
   names, real email/account records, authorization headers/cookies, production payload fingerprints,
   unredacted process environments, and non-loopback URLs. Seed a canary in a temporary artifact and prove
   the scan bites.
3. Isolation requires `BROWSER_QUALITY_BASE_REVISION=<40-hex>` in an isolated clean worktree and computes
   the complete changed path set. This first lands the repository/tooling seams plus the exact D7
   product-source allowlist; F9C activates that D7 guard before product edits and F9D later expands it by
   exact-file equality for D8 without ever admitting a directory prefix:

   ```text
   package.json
   package-lock.json
   apps/dashboard-e2e/**
   .github/workflows/ci.yml
   .github/workflows/browser-visual-linux-candidates.yml
   apps/dashboard/src/app/shared/ui/Widget/Widget.tsx
   apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx
   apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx
   apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx
   apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx
   apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx
   apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx
   apps/dashboard/src/app/features/auth/SettingsPage.tsx
   apps/dashboard/src/app/shell/AppShell.tsx
   ```

   It separately rejects runtime dependency changes, every dashboard source path not named above,
   dashboard public assets, `libs/api`, `apps/api`, or `libs/quant-engine`. It hashes forbidden trees and
   non-allowlisted dashboard source at base/current revision; a poison edit to each class must fail.
4. Run all 12 mutation controls, artifact safety on four roots, isolation from the recorded pre-feature
   base, root lint/typecheck/unit/build, and the existing 52-test suite. Commit
   `test(e2e): mutation-probe browser quality gates`.

**Reviewer probes:** add one product source edit outside the staged D7/final D7+D8 allowlist, leak a synthetic auth cookie
into a trace, disable the serious control, or let a mutation pass vacuously. The applicable suite must
fail.

### F9A — Repair the five diagnosed fixture/oracle defects at the e2e boundary

**Files:** `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`;
`apps/dashboard-e2e/src/quality/fixtures/strict-fixture.ts`;
`apps/dashboard-e2e/src/quality/compatibility.spec.ts`;
`apps/dashboard-e2e/src/quality/accessibility.spec.ts`;
`apps/dashboard-e2e/tools/d7-fixture-repairs.spec.mjs`.

**Depends on:** F0, F1, F2, F3, F4, F5, F6, F7, F8, F9.

1. Add five named RED controls, one per AC34–38, before changing fixture setup. The Scanner control must
   reject a ticker-shaped `/api/stream/prices` frame and accept only the application-consumed
   `{ prices: { SYMBOL: { price, ts } } }` envelope. The book control seeds exactly
   `fixture-position-0..2`, loads authenticated Positions, and compares the ordered localStorage IDs after
   session/book initialization. The anonymous control observes the same anonymous session through wall,
   dialog, close, and focus return. The watchdog control proves the offline marker is absent through
   14,999 ms and present only after the final millisecond. The zoom control proves a real isolated
   Chromium page reaches `visualViewport.scale === 2` before checking controls. Run:

   ```powershell
   node --test apps/dashboard-e2e/tools/d7-fixture-repairs.spec.mjs
   npx playwright test --config apps/dashboard-e2e/playwright.compat.config.ts --grep "signed-out|dense-positions|dense-scanner|stream-loss"
   npx playwright test --config apps/dashboard-e2e/playwright.a11y.config.ts --grep "A11Y-B3|A11Y-B6|A11Y-B7"
   ```

   At least one named control for each defect must fail on the pre-repair bytes; record the five failure
   messages. A collection error is not an acceptable RED.
2. In `strict-fixture.ts`, dispatch the two SSE contracts explicitly rather than fulfilling every stream
   path with one ticker payload. Preserve strict abort for every undeclared stream:

   ```ts
   if (url.pathname === '/api/stream/prices') {
     return route.fulfill({
       status: 200,
       contentType: 'text/event-stream',
       body: `data: ${JSON.stringify({
         prices: {
           SPY: { price: 500, ts: Date.parse(scenario.now) / 1000 },
           QQQ: { price: 490, ts: Date.parse(scenario.now) / 1000 },
           NVDA: { price: 480, ts: Date.parse(scenario.now) / 1000 },
         },
       })}\n\n`,
     });
   }
   if (url.pathname === '/api/stream/SPY' && scenario.stream !== 'none') {
     return route.fulfill({
       status: 200,
       contentType: 'text/event-stream',
       body: 'data: {"ticker":"SPY","mid":500,"last_trade":500,"net_flow":1,"live":true}\n\n',
     });
   }
   ```

   Match query strings through `url.pathname`/declared scenario state, not a broad `/api/stream/`
   prefix. A malformed Scanner arm must be an explicit test poison, never the positive fixture.
3. In `scenarios.ts`, make the signed-in server-book fixture unable to replace the local seed:

   ```ts
   'GET /api/book': response({ blob: {}, updated_at: 0 }),
   ```

   After readiness, assert the durable `convexa.positions.v3` position-key set remains exactly the three
   seeded IDs. Do not compensate by changing the production store or disabling its book pull.
4. Stop changing only the `auth` property of an already-built scenario. Add a scenario constructor/helper
   that rebuilds `durableSeed` and `GET /api/auth/session` together, or reuse the existing
   `signed-out-auth-dialog` journey in A11Y-B3. The invariant is:

   ```ts
   scenario.auth === 'anonymous'
     && JSON.parse(scenario.rest['GET /api/auth/session'].body).authenticated === false
     && scenario.durableSeed['convexa.positions.v3'] === undefined
   ```

   The wall/dialog/focus test must not spread an authenticated A11Y scenario and relabel it anonymous.
5. For A11Y-B6 and the Ticker stream-loss journey, observe a successful payload first, assert no offline
   marker, then advance the installed Playwright clock `14_999`, assert still online, advance `1`, and
   require the three exact non-colour degraded cues. Do not use `16_000`, a closed-stream error, polling,
   or an early assertion as the watchdog oracle.
6. Replace the CSS `documentElement.style.zoom` arm with a dedicated Chromium context/page. Create a CDP
   session with `context.newCDPSession(page)`, call
   `Emulation.setPageScaleFactor({ pageScaleFactor: 2 })`, and require
   `expect.poll(() => page.evaluate(() => visualViewport?.scale ?? 1)).toBe(2)` before navigating/focusing
   the named controls. Run the 393px compact arm in a separate fresh context so scale state cannot leak.
   Firefox/WebKit never execute this Chromium-only behavior.
7. In `d7-fixture-repairs.spec.mjs`, mutation-copy each positive fixture/oracle into an OS temporary tree,
   reintroduce the old malformed Scanner envelope, `updated_at:1` empty book overwrite, authenticated
   anonymous response, pre-boundary watchdog assertion, and CSS zoom substitute, then spawn the matching
   focused check and require non-zero. Restore by hash and require green. Run the three commands from step
   1 green, `npx nx run dashboard-e2e:typecheck`, and commit
   `test(e2e): repair deterministic browser fixtures`.

**Reviewer probes:** substitute the ticker stream payload for Scanner, return an empty newer book, spread
an authenticated scenario into A11Y-B3, delete the final one-millisecond clock advance, or restore CSS
zoom. Each probe must fail its own AC34–38 control without a product-source edit.

### F9B — Apply only the owner-authorized product accessibility corrections

**Files:** `apps/dashboard-e2e/src/quality/accessibility.spec.ts`;
`apps/dashboard/src/app/shared/ui/Widget/Widget.tsx`;
`apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx`;
`apps/dashboard/src/app/features/auth/SettingsPage.tsx`;
`apps/dashboard/src/app/shell/AppShell.tsx`.

**Depends on:** F9A.

1. Extend the real A11Y-3/A11Y-4/A11Y-B1/A11Y-8 browser oracles first and observe RED against product
   bytes. The exact assertions are: every `.widget__grip` is a non-focusable `span`, has no `aria-label`,
   and yields no `aria-prohibited-attr`; no serious/critical `color-contrast` node targets any AC30
   selector; the actual input `[data-testid="settings-ticker"]` has accessible name `Default ticker` and
   no `label`/`label-title-only` node; the skip link is the first Tab stop and Enter focuses
   `main#main-content` while `new URL(page.url()).pathname === '/settings'` and `.hash === ''`; and the
   cold 503 alert contains `API error 503` plus keyboard-reachable `Retry` and excludes
   `Unable to load ticker test fixture.`. Run the focused A11Y command and require a behavioral/assertion
   failure, not a selector miss.
2. In `Widget.tsx`, keep the visual affordance but remove the prohibited name from the non-operable grip.
   Use `describeChild` on the existing Tooltip and make the span explicitly decorative/non-focusable:

   ```tsx
   <Tooltip arrow describeChild title="Rearrange (coming soon)">
     <Box component="span" aria-hidden="true" className="widget__grip" sx={...}>
   ```

   Do not add a role, `tabIndex`, click/keyboard handler, drag behavior, new control, or layout change.
   Keep subtitle color on `text.secondary` but remove the `quiet` opacity reduction so its effective
   contrast is not lowered:

   ```tsx
   sx={{ color: 'text.secondary', mt: 0.25 }}
   ```
3. In `TickerDashboard.tsx`, retain the section's `text.secondary` token and all typography/layout, but
   do not lower the Supporting context label with `opacity: 0.75`. The opacity expression becomes
   `opacity: first ? 0.8 : 1`. In each of
   `DealerFlowProjection.tsx`, `MarketContext.tsx`, `IvRank.tsx`, and `StraddleMove.tsx`, change only the
   named whole-empty `Typography` color from `text.disabled` to `text.secondary`. In
   `TermStructure.tsx`, make the same one-token replacement on the exact
   `Term structure unavailable this cycle.` node. Do not change visible wording, hierarchy, padding,
   font size/weight, hardcode a color, or touch a token/theme file.
4. In `SettingsPage.tsx`, put the programmatic name on the actual HTML input, not the TextField wrapper:

   ```tsx
   slotProps={{
     htmlInput: { 'aria-label': C.defaultTicker, 'data-testid': 'settings-ticker' },
   }}
   ```

   Remove the outer `aria-label` if MUI would otherwise duplicate/misplace it. Keep visible
   `FieldLabel`, helper copy, validation, persistence, and layout byte-for-byte.
5. In `AppShell.tsx`, retain the anchor, exact copy, and focus-visible styles but intercept activation:

   ```tsx
   onClick={(event) => {
     event.preventDefault();
     document.getElementById('main-content')?.focus();
   }}
   ```

   Keep `href="#main-content"` for link semantics; preventing its default fragment navigation is what
   preserves `/settings`. Do not add a route/history entry, scroll manager, or new focus style.
6. For AC33, change only the A11Y-8 fixture/readiness oracle to an HTTP 503 whose rendered client result is
   `API error 503`. The response detail may be synthetic service text, but the test may not assert or
   render it. Do not edit `libs/api` or `TickerDashboard.tsx` for the already-shipped status mapping.
7. Run the focused A11Y tier green, then `npx nx test @convexa/dashboard`,
   `npx nx run @convexa/dashboard:typecheck`, and `npx nx run @convexa/dashboard:lint`. Inspect the exact
   product diff and commit `fix(dashboard): repair bounded accessibility findings`.

**Reviewer probes:** restore the grip's `aria-label`, reintroduce opacity on one named target, move the
Settings label back to the TextField wrapper, remove `preventDefault`, or assert fixture prose on the cold
error. Each probe must fail AC29, AC30, AC31, AC32, or AC33 respectively.

### F9C — Enforce the D7 boundary and re-run joined regression evidence

**Files:** `apps/dashboard-e2e/tools/isolation.mjs`;
`apps/dashboard-e2e/tools/isolation.spec.mjs`;
`apps/dashboard-e2e/tools/mutations.spec.mjs`;
`apps/dashboard-e2e/tools/d7-boundary.spec.mjs`.

**Depends on:** F9B.

1. Replace F9's former blanket dashboard-source rejection with a closed `D7_PRODUCT_ALLOWLIST` containing
   exactly the nine F9B product files. `isAllowedPath()` admits repository tooling seams plus those exact
   files; it still rejects every other `apps/dashboard/src/**` path and every dashboard public/API/backend/
   quant path. Add a second check over `package.json`/lock changes proving `@axe-core/playwright` is a dev
   dependency and that no runtime dependency changed.
2. Write RED mutations for one adjacent product file, one global theme/token file, one public asset, one
   route file, one API/backend/quant file, and one runtime dependency; each must be rejected. Also mutate
   every AC29–33 repair back to its diagnosed form and every AC34–38 fixture repair back independently;
   the corresponding focused oracle must fail while the closed 52/5/9/7/6 manifest counts remain equal.
   A product edit that makes a malformed fixture test pass is itself a failing mutation result.
3. `d7-boundary.spec.mjs` asserts the changed dashboard-source set is a subset of the exact allowlist and
   source-scans the current diff for forbidden hardcoded colors, token/theme edits, route/layout/motion/
   persistence/API changes, and changed visible D7 strings. It must not claim semantic correctness from
   source alone; the browser oracles remain authoritative.
4. Run all structural/mutation tests, the real Chromium/compatibility/accessibility tiers, dashboard unit/
   lint/typecheck/build checks, and scoped formatting before handing off to visual review:

   ```powershell
   node --test apps/dashboard-e2e/tools/*.spec.mjs
   npm run browser:chromium
   npm run browser:compat
   npm run browser:a11y
   npx nx test @convexa/dashboard
   npx nx run @convexa/dashboard:lint
   npx nx run @convexa/dashboard:typecheck
   npm run build:dashboard
   npm run check:bundle
   npx prettier --check apps/dashboard/src/app/shared/ui/Widget/Widget.tsx apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx apps/dashboard/src/app/features/auth/SettingsPage.tsx apps/dashboard/src/app/shell/AppShell.tsx apps/dashboard-e2e
   git diff --check
   ```

   Expected: all commands exit 0; Chromium is 52/52, compatibility is 15/15, accessibility is 16/16
   with all five D7 product oracles and all five fixture-repair controls observed; bundle thresholds remain
   green. Commit `test(e2e): enforce d7 browser repair boundary`.

**Reviewer probes:** allow an `apps/dashboard/src/` prefix, compensate for malformed Scanner data in product
code, change a global token, or omit one repair mutation. The boundary/mutation suite must fail.

### F9D — Repair and lock the D8 closed-matrix accessibility findings

**Files:** `apps/dashboard/src/app/pages/scanner/ScanCard.tsx`;
`apps/dashboard/src/app/pages/scanner/ScanCells.tsx`;
`apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx`;
`apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx`;
`apps/dashboard/src/app/features/trading/positions/PositionRow.tsx`;
`apps/dashboard/src/app/features/trading/positions/PlSparkline.tsx`;
`apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx`;
`apps/dashboard/src/app/features/trading/positions/CustomizationToolbar.tsx`;
`apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx`;
`apps/dashboard/src/app/features/trading/positions/PositionCard.tsx`;
`apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx`;
`apps/dashboard/src/app/features/trading/positions/LegDisclosure.tsx`;
`apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx`;
`apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx`;
`apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx`;
`apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx`;
`apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx`;
`apps/dashboard/src/app/features/auth/RequireAuth.tsx`;
`apps/dashboard/src/app/features/auth/AuthDialogProvider.tsx`;
`apps/dashboard/src/app/features/auth/AuthDialog.tsx`;
`apps/dashboard/src/app/features/auth/auth.risk.spec.tsx`;
`apps/dashboard-e2e/src/quality/accessibility.spec.ts`;
`apps/dashboard-e2e/src/quality/compatibility.spec.ts`;
`apps/dashboard-e2e/tools/isolation.mjs`;
`apps/dashboard-e2e/tools/isolation.spec.mjs`;
`apps/dashboard-e2e/tools/mutations.spec.mjs`;
`apps/dashboard-e2e/tools/d8-boundary.spec.mjs`.

**Depends on:** F9C.

1. Add focused component RED tests before changing product bytes. Run only the exact files below and
   require a genuine assertion failure for each AC40–45; a missing selector, collection error, snapshot
   rewrite, or skipped test is not RED:

   ```powershell
   npx vitest run --config apps/dashboard/vite.config.mts apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx apps/dashboard/src/app/features/auth/auth.risk.spec.tsx
   ```

   The tests must prove: two compact Scanner cards form two consecutive native-link Tab stops while the
   nested score forms none and its why-this-score text still names/describes the link; the three exact
   AC41 text nodes resolve to an existing readable theme slot without opacity reduction; the position
   trend help is owned by a valid non-SVG wrapper while the SVG remains `aria-hidden` and non-focusable;
   every AC43 testid, including `positions-disclosure` and all `[data-testid^="tr-family-empty-"]` nodes,
   resolves without a serious/critical contrast defect; Escape restores the identical
   still-mounted `require-auth-signin` node; and focusing `open-entry`, `tab-live`, or
   `leg-disclosure-toggle` calls the bounded focus-scroll seam. Preserve one assertion for the unchanged
   393px component composition.
2. For AC40, keep the card itself as the only link. Add a stable description ID in `ScanCard`, attach it
   to the link with `aria-describedby`, and render the existing `whyThisRow(row)` information in a
   visually hidden, non-focusable span. Add a `focusableHelp?: boolean` input to `ScoreCell`, defaulting to
   the existing table behavior, and pass `false` from the card so its score renders without `tabIndex`,
   nested interactive Tooltip semantics, role, or click/keyboard action:

   ```tsx
   const scoreDescriptionId = useId();
   const visuallyHidden = {
     position: 'absolute', width: 1, height: 1, p: 0, m: -1,
     overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
   } as const;

   <Box component={RouterLink} aria-describedby={scoreDescriptionId} ...>
     <ScoreCell row={row} delta={delta} focusableHelp={false} />
     <Box component="span" id={scoreDescriptionId} sx={visuallyHidden}>
       {whyThisRow(row)}
     </Box>
   </Box>
   ```

   The table continues to use the default focusable score help. Do not alter ticker routes, scores,
   tiers, fingerprints, card layout, or visible score content.
3. For AC41, change only the named empty/offline text styling: the `Vol/OI unavailable this cycle.` node
   in `FreshPositioning.tsx`, `Off-exchange data unavailable this cycle.` in `OffExchangeBlocks.tsx`, and
   `[data-testid="tape-stream-state"]` in `TapePulseStrip.tsx` use `color: 'text.secondary'` with effective
   opacity `1`. Keep every string, state branch, hierarchy, size, and surrounding muted text unchanged.
   Component tests render both shipped themes and compare computed ink/background contrast; the real
   A11Y-3/A11Y-9 axe scans remain the acceptance oracle.
4. For AC42, make the Tooltip child in the `trend` branch of `PositionRow.tsx` one explicit HTML wrapper,
   not an SVG or an anonymous wrapper whose relationship lands on the SVG. Use `describeChild`, a named
   `data-testid="trend-help"` span, and a focusable wrapper only if required to expose the existing help;
   make the `PlSparkline` root `component="span"`, and retain its
   `<svg aria-hidden focusable="false">`, current samples, P/L colors, size, offline cue, and computation:

   ```tsx
   <Tooltip arrow describeChild title={TREND_TIP}>
     <Box component="span" data-testid="trend-help" tabIndex={0} sx={{ display: 'inline-flex' }}>
       <PlSparkline samples={ctx.trend} offline={streamOffline} />
     </Box>
   </Tooltip>
   ```

   The focused test requires the help relationship on `trend-help`, rejects one on the SVG, and fails if
   the relationship or tooltip content is removed.
5. For AC43, alter only the named descendants of `customization-toolbar`, `leg-disclosure-toggle`,
   `card-structure-chip`, `card-risk-slot`, `card-max-loss`, `history-button`, and `status-chips`. Replace
   failing `text.disabled`/effective-opacity treatment with the existing `text.secondary` or the existing
   control foreground appropriate to that component; do not hardcode colors or edit theme/token files.
   Apply the same contrast-only rule to `[data-testid="positions-disclosure"]` in `PositionsPanel.tsx` and
   the exact `[data-testid^="tr-family-empty-"]` empty-family nodes in `TrackRecordSection.tsx`. Prove those
   selectors in `positions.risk.spec.tsx` and `outcomes/track-record.flow.spec.tsx`; do not touch another
   Positions/Outcomes source or evidence file. Keep financial-direction tinting, labels, grouping, state
   meaning, hierarchy, dimensions, and layout. The component tests assert the affected node set and
   theme-slot/effective-opacity boundary; A11Y-5 axe is authoritative for serious/critical contrast.
6. For AC44, make opener restoration explicit instead of relying on incidental dialog behavior. Extend
   `OpenOpts` with `returnFocus?: HTMLElement | null`; store that exact connected node in a provider ref,
   and after `open` transitions false focus it once with `{ preventScroll: true }`, then clear the ref.
   Give the `RequireAuth` sign-in button a ref and call
   `openAuth({ returnFocus: signInRef.current })`:

   ```tsx
   const returnFocusRef = useRef<HTMLElement | null>(null);
   const wasOpenRef = useRef(false);

   const openAuth = useCallback((opts: OpenOpts = {}) => {
     returnFocusRef.current = opts.returnFocus?.isConnected ? opts.returnFocus : null;
     // retain the existing mode/reason/onSuccess assignments
     setOpen(true);
   }, []);

   useEffect(() => {
     if (wasOpenRef.current && !open) {
       const target = returnFocusRef.current;
       returnFocusRef.current = null;
       requestAnimationFrame(() => target?.isConnected && target.focus({ preventScroll: true }));
     }
     wasOpenRef.current = open;
   }, [open]);

   const signInRef = useRef<HTMLButtonElement>(null);
   <Button ref={signInRef} onClick={() => openAuth({ returnFocus: signInRef.current })} ... />
   ```

   `AuthDialog` continues to own containment/Escape close
   and must not replace, clone, or remount the opener. The component and browser tests retain the opener
   handle before Enter, wait for the dialog to detach, and require `document.activeElement === opener`;
   `body`, another control, or a same-selector replacement fails.
7. For AC45, add the same bounded, visual-viewport-aware handler only to `open-entry`, `tab-live`, and
   `leg-disclosure-toggle`. Ordinary layout-viewport `scrollIntoView` is explicitly insufficient and must
   not be used. Compute the current visual rectangle from `visualViewport.offsetLeft`, `offsetTop`,
   `width`, and `height`; do nothing when the focused named control already intersects it; otherwise move
   the document only by the minimum edge delta needed to reveal that control:

   ```tsx
   const revealFocusedControl = (event: React.FocusEvent<HTMLElement>) => {
     const viewport = window.visualViewport;
     if (!viewport) return;
     const rect = event.currentTarget.getBoundingClientRect();
     const left = viewport.offsetLeft;
     const top = viewport.offsetTop;
     const right = left + viewport.width;
     const bottom = top + viewport.height;
     const intersects =
       rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom;
     if (intersects) return;
     const dx = rect.right <= left ? rect.left - left : rect.left >= right ? rect.right - right : 0;
     const dy = rect.bottom <= top ? rect.top - top : rect.top >= bottom ? rect.bottom - bottom : 0;
     window.scrollBy({ left: dx, top: dy, behavior: 'auto' });
   };
   // each named existing control: onFocus={revealFocusedControl}
   ```

   Keep this small helper local to each already authorized owner rather than adding another product file.
   Co-located tests stub a 640×450 visual viewport with non-zero offsets and prove: an intersecting control
   produces no scroll; a non-intersecting named control calls `window.scrollBy` with the computed minimum
   delta; an unrelated element never enters the seam; and `scrollIntoView` is never called. The browser
   test is stronger: in a fresh Chromium page it proves `visualViewport.scale === 2`, keyboard-focuses the
   controls in the specified order, awaits scroll settlement, and requires rectangle/visual-viewport
   intersection after each. The independent 393×852 arm still proves `innerWidth === 393`, no horizontal
   overflow, and unchanged compact composition. CSS `zoom`, a new breakpoint/layout mode, position/fixed
   hacks, ordinary layout-viewport scrolling, and weakened intersection predicates are forbidden.
8. Extend only existing closed-matrix browser cases: A11Y-3/A11Y-9 for AC41, A11Y-5 for AC42–43,
   A11Y-6/A11Y-B5 for AC40, compatibility journey 3/A11Y-B3 for AC44, and A11Y-B7 for AC45. Do not add a
   sixth journey, tenth scan, eighth behavior, seventh image, axe waiver, threshold exception, mask, or
   tolerance. Run:

   ```powershell
   npx playwright test --config apps/dashboard-e2e/playwright.a11y.config.ts --project=chromium --grep "A11Y-3|A11Y-5|A11Y-6|A11Y-9|A11Y-B3|A11Y-B5|A11Y-B7"
   npx playwright test --config apps/dashboard-e2e/playwright.compat.config.ts --project=chromium --grep "signed-out"
   ```

   Expected: every named arm passes with no skip/flaky result; the collection remains exactly 9 scans + 7
   behaviors and 5 journeys × 3 engines. Reverting any one repair makes its focused browser arm fail.
9. Expand `isolation.mjs` from `D7_PRODUCT_ALLOWLIST` to exact `D7_D8_PRODUCT_ALLOWLIST`: the 25 product
   files in Global Constraints plus exactly the ten co-located test files listed by this task. Keep exact
   file equality; never admit a dashboard directory prefix. In `d8-boundary.spec.mjs` and
   `mutations.spec.mjs`, reverse each AC40–45 repair independently and require its component/browser oracle
   non-zero; poison an adjacent Scanner/Ticker/Positions/Auth file, token/theme file, route, public asset,
   runtime dependency, API/backend/quant path, and each must be rejected. Source checks may reject
   hardcoded colors, new layout modes, changed copy/routes/state flow, or weakened matrices, but cannot
   substitute for browser evidence.
10. Run all focused tests, the complete Chromium compatibility/accessibility tiers, and dashboard
    regressions:

    ```powershell
    node --test apps/dashboard-e2e/tools/d8-boundary.spec.mjs
    node --test apps/dashboard-e2e/tools/mutations.spec.mjs
    $env:BROWSER_QUALITY_BASE_REVISION='<pre-feature-40-hex>'
    node --test apps/dashboard-e2e/tools/isolation.spec.mjs
    npm run browser:compat
    npm run browser:a11y
    npx nx test @convexa/dashboard
    npx nx run @convexa/dashboard:lint
    npx nx run @convexa/dashboard:typecheck
    npm run build:dashboard
    npm run check:bundle
    git diff --check
    ```

    Expected: component tests and D8 mutations pass; compatibility remains 15/15 and accessibility 16/16
    with AC40–45 observed in the real Chromium arms; dashboard test/lint/typecheck/build/bundle checks exit
    0. The diff contains no dashboard product or co-located test file beyond the exact D7/D8 allowlist.
    Commit `fix(dashboard): repair closed-matrix accessibility findings`.

**Reviewer probes:** restore the nested score tab stop, remove the link-level description, restore one
named disabled/opacity style, attach the trend Tooltip to the SVG, close the dialog without the original
opener, replace real page scale with CSS zoom, add a layout breakpoint, or permit a directory prefix. Each
probe must fail the exact AC40–45 component/browser/boundary control.

### F10-frontend-closer — Bootstrap reviewed platform baselines and run the complete real gate

**Files:** `apps/dashboard-e2e/src/quality/snapshots/**`;
`apps/dashboard-e2e/visual-review/authorizations/**`;
`apps/dashboard-e2e/visual-review/candidate-sets/**`;
`apps/dashboard-e2e/visual-review/acceptances/**`;
`apps/dashboard-e2e/visual-review/diffs/**`.

**Depends on:** F0, F1, F2, F3, F4, F5, F6, F7, F8, F9, F9A, F9B, F9C, F9D.

This is the one frontend/tooling lane closer. It does not repair or re-implement worker paths.

1. From unchanged implementation bytes on the current host, run compare-only. It must fail on six missing
   current-platform baselines and retain actual/missing-baseline evidence without writing expected PNGs.
2. Stop for an owner/design reviewer to inspect all six compositions against
   `.spire/clusters/tech/context/DESIGN_SYSTEM.md` and author the exact authorization receipt. The closer
   validates it but does not create/edit it. Run the authorized update once; require exactly six PNGs and
   one `candidates_written` receipt, with no human-receipt mutation.
3. Produce the exact source diff patch. Stop for a code reviewer to inspect all six PNGs and the patch and
   author an accepted or rejected receipt. A rejection stops cleanly; it is not rewritten. For acceptance,
   validate every current hash and run two distinct compare-only invocations with retries zero. Only then
   require `stability_clean`.
4. Run `npm run browser:quality` once. Confirm four children settled once, counts 52/52, 15/15, 16/16
   (9 scans + 7 behaviors), and 6/6, with zero flaky/not-run locally and a valid aggregate receipt. Run
   artifact safety, the amended D7/D8 forbidden-diff isolation, every AC29–45 reverse mutation, all
   structural/mutation tests, lint, typecheck, unit tests, dashboard production build, and format/diff
   checks. Re-observe the D7/D8 product outcomes and five fixture outcomes; do not infer them from source.
   Do not claim hosted PASS; print the exact NOT RUN line.
5. The Linux platform remains absent until the protected manual workflow described in SPEC §2 can really
   run. Do not create Linux bytes on Windows. When runners return, repeat the same failed compare → human
   authorization → protected candidate upload → reviewed commit/acceptance → two Ubuntu comparisons flow.
6. Commit only the externally authored reviewed receipts, source-diff, and accepted current-platform PNGs
   as `test(e2e): accept reviewed platform baselines`. If either human receipt is unavailable, report the
   exact carry-forward state and do not manufacture a green closer result.

## Independence

This is one cohesive frontend/repository-tooling lane and cannot be split safely under the prefix rule.
Although amended SPEC §4 names the D7/D8 source files, F9A/F9B/F9D amend the shared browser specs, F9C
and F9D successively update the same isolation/mutation seams, and F10 consumes every prior result. F0–F9
also join shared manifest, package, config, summary, and workflow surfaces. Every row is therefore honestly
`Independent: no` and the repair tasks execute F9A → F9B → F9C → F9D. There is no backend row because
the backend track is explicitly empty. F10 remains the exactly-one frontend closer.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| F0 | frontend | `apps/dashboard-e2e/src/quality/manifest.json`; `apps/dashboard-e2e/tools/lib/manifest.mjs`; `apps/dashboard-e2e/tools/manifest.spec.mjs`; `apps/dashboard-e2e/tools/browser-policy.spec.mjs`; `apps/dashboard-e2e/README.md`; `package.json`; `package-lock.json` | — | no |
| F1 | frontend | `apps/dashboard-e2e/src/quality/fixtures/**`; `apps/dashboard-e2e/src/quality/readiness.ts`; `apps/dashboard-e2e/src/quality/fixture-contract.spec.ts`; `apps/dashboard-e2e/tools/fixture-contract.spec.mjs` | F0 | no |
| F2 | frontend | `apps/dashboard-e2e/src/quality/reporters/**`; `apps/dashboard-e2e/tools/lib/summary.mjs`; `apps/dashboard-e2e/tools/lib/runtime-identity.mjs`; `apps/dashboard-e2e/tools/lib/fs-safe.mjs`; `apps/dashboard-e2e/tools/summary.spec.mjs` | F0 | no |
| F3 | frontend | `apps/dashboard-e2e/playwright.shared.config.ts`; `apps/dashboard-e2e/playwright.config.ts`; `apps/dashboard-e2e/tools/run-gate.mjs`; `apps/dashboard-e2e/tools/chromium-inventory.spec.mjs` | F0, F2 | no |
| F4 | frontend | `apps/dashboard-e2e/playwright.compat.config.ts`; `apps/dashboard-e2e/src/quality/compatibility.spec.ts`; `apps/dashboard-e2e/tools/compatibility.spec.mjs` | F1, F2, F3 | no |
| F5 | frontend | `apps/dashboard-e2e/playwright.a11y.config.ts`; `apps/dashboard-e2e/src/quality/accessibility.spec.ts`; `apps/dashboard-e2e/src/quality/a11y-waivers.json`; `apps/dashboard-e2e/src/quality/a11y.ts`; `apps/dashboard-e2e/tools/a11y-policy.spec.mjs` | F1, F2, F3 | no |
| F6 | frontend | `apps/dashboard-e2e/playwright.visual.config.ts`; `apps/dashboard-e2e/src/quality/visual.spec.ts`; `apps/dashboard-e2e/tools/visual-update.mjs`; `apps/dashboard-e2e/tools/lib/visual-review.mjs`; `apps/dashboard-e2e/tools/visual-review.spec.mjs`; `apps/dashboard-e2e/visual-review/README.md`; `apps/dashboard-e2e/visual-review/schemas/**` | F1, F2, F3 | no |
| F7 | frontend | `apps/dashboard-e2e/tools/run-quality.mjs`; `apps/dashboard-e2e/tools/lib/process.mjs`; `apps/dashboard-e2e/tools/lib/aggregate.mjs`; `apps/dashboard-e2e/tools/validate-publication.mjs`; `apps/dashboard-e2e/tools/run-quality.spec.mjs` | F2, F3, F4, F5, F6 | no |
| F8 | frontend | `apps/dashboard-e2e/project.json`; `package.json`; `.github/workflows/ci.yml`; `.github/workflows/browser-visual-linux-candidates.yml`; `apps/dashboard-e2e/tools/wiring.spec.mjs` | F3, F4, F5, F6, F7 | no |
| F9 | frontend | `apps/dashboard-e2e/tools/mutations.spec.mjs`; `apps/dashboard-e2e/tools/isolation.spec.mjs`; `apps/dashboard-e2e/tools/artifact-safety.spec.mjs` | F0, F1, F2, F3, F4, F5, F6, F7, F8 | no |
| F9A | frontend | `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`; `apps/dashboard-e2e/src/quality/fixtures/strict-fixture.ts`; `apps/dashboard-e2e/src/quality/compatibility.spec.ts`; `apps/dashboard-e2e/src/quality/accessibility.spec.ts`; `apps/dashboard-e2e/tools/d7-fixture-repairs.spec.mjs` | F0, F1, F2, F3, F4, F5, F6, F7, F8, F9 | no |
| F9B | frontend | `apps/dashboard-e2e/src/quality/accessibility.spec.ts`; `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx`; `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx`; `apps/dashboard/src/app/features/auth/SettingsPage.tsx`; `apps/dashboard/src/app/shell/AppShell.tsx` | F9A | no |
| F9C | frontend | `apps/dashboard-e2e/tools/isolation.mjs`; `apps/dashboard-e2e/tools/isolation.spec.mjs`; `apps/dashboard-e2e/tools/mutations.spec.mjs`; `apps/dashboard-e2e/tools/d7-boundary.spec.mjs` | F9B | no |
| F9D | frontend | `apps/dashboard/src/app/pages/scanner/ScanCard.tsx`; `apps/dashboard/src/app/pages/scanner/ScanCells.tsx`; `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx`; `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx`; `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx`; `apps/dashboard/src/app/features/trading/positions/PlSparkline.tsx`; `apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx`; `apps/dashboard/src/app/features/trading/positions/CustomizationToolbar.tsx`; `apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx`; `apps/dashboard/src/app/features/trading/positions/PositionCard.tsx`; `apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx`; `apps/dashboard/src/app/features/trading/positions/LegDisclosure.tsx`; `apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx`; `apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx`; `apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx`; `apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx`; `apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx`; `apps/dashboard/src/app/features/auth/RequireAuth.tsx`; `apps/dashboard/src/app/features/auth/AuthDialogProvider.tsx`; `apps/dashboard/src/app/features/auth/AuthDialog.tsx`; `apps/dashboard/src/app/features/auth/auth.risk.spec.tsx`; `apps/dashboard-e2e/src/quality/accessibility.spec.ts`; `apps/dashboard-e2e/src/quality/compatibility.spec.ts`; `apps/dashboard-e2e/tools/isolation.mjs`; `apps/dashboard-e2e/tools/isolation.spec.mjs`; `apps/dashboard-e2e/tools/mutations.spec.mjs`; `apps/dashboard-e2e/tools/d8-boundary.spec.mjs` | F9C | no |
| F10-frontend-closer | frontend | `apps/dashboard-e2e/src/quality/snapshots/**`; `apps/dashboard-e2e/visual-review/authorizations/**`; `apps/dashboard-e2e/visual-review/candidate-sets/**`; `apps/dashboard-e2e/visual-review/acceptances/**`; `apps/dashboard-e2e/visual-review/diffs/**` | F0, F1, F2, F3, F4, F5, F6, F7, F8, F9, F9A, F9B, F9C, F9D | no |

## Verification track

Run from repository root in a clean worktree with all three locked Playwright engines installed. Commands
below are compare-only unless explicitly labeled candidate generation. Expected counts are exact; skips,
zero selection, flaky/retry-only results, missing artifacts, or different counts fail.

### V1 — Policy, manifest, runtime identity, and build intent

```powershell
node --test apps/dashboard-e2e/tools/manifest.spec.mjs
node --test apps/dashboard-e2e/tools/browser-policy.spec.mjs
npx playwright test --config apps/dashboard-e2e/playwright.config.ts --list
```

Expected: 20/20 manifest tests and all browser-policy checks pass; Playwright lists exactly 52 Chromium
tests in five files. Lock resolution is Playwright 1.62.1 and axe Playwright 4.13.0; engine revisions match
the installed `browsers.json`; Vite remains `es2022` and is labeled emitted-code intent only.

### V2 — Strict fixture/readiness and summary mutation tests

```powershell
node --test apps/dashboard-e2e/tools/fixture-contract.spec.mjs
node --test apps/dashboard-e2e/tools/summary.spec.mjs
npx playwright test --config apps/dashboard-e2e/playwright.a11y.config.ts --list
```

Expected: 24/24 fixture tests, all 18 readiness positive/forbidden poison arms, and 20/20 summary tests
pass. A11Y collection is exactly 16 tests (9 scans + 7 behaviors). Unexpected REST/SSE/external traffic,
wrong state, zero work, flake, or an artifact/source hash mismatch turns the focused suite red.

### V3 — Retained Chromium and compatibility execution

```powershell
npm run browser:chromium
npm run browser:compat
```

Expected: Chromium 52/52 with exactly 52 manifest-equal `tests[]`; compatibility 15/15 with every five
journeys in Chromium, Firefox, and WebKit. Both summaries name Playwright/project/engine/revision and resolved
artifact hashes. A temporary single-arm poison fails only that engine/journey while the other 14 report.

### V4 — Accessibility execution and negative controls

```powershell
node --test apps/dashboard-e2e/tools/a11y-policy.spec.mjs
npm run browser:a11y
```

Expected: 35/35 policy/mutation tests and 16/16 browser tests; summary proves nine scan identities and seven
behavior identities. Known serious/critical injection exits non-zero with exact route/state/rule/help/target;
known moderate/minor remains visible and does not alone fail. All A11Y-B oracles, including 200% scale and
393px bounds, pass. Waiver inventory is empty unless a separately evidenced exact waiver exists.

### V5 — Visual no-write, authority, and stability

```powershell
node --test apps/dashboard-e2e/tools/visual-review.spec.mjs
npm run browser:visual
```

Expected: 42/42 receipt/update/stability tests. With reviewed current-platform baselines, compare is 6/6,
zero retries/flakes, and changes no PNG hash. Temporary missing-baseline and changed-pixel controls fail with
actual/diff evidence and no expected write. The candidate command is run only during the F10 human flow:

```powershell
npm run browser:visual:update -- --authorization apps/dashboard-e2e/visual-review/authorizations/<authorization_id>.json
```

Expected there: exactly six current-platform PNGs plus one candidate-set receipt; authorization and
acceptance trees byte-identical. It prints UPDATED, never approved. Acceptance plus two distinct clean
compare summaries is the only `stability_clean` result.

### V6 — Aggregate process and independent-evidence controls

```powershell
node --test apps/dashboard-e2e/tools/run-quality.spec.mjs
npm run browser:quality
```

Expected: 18/18 process/aggregate tests. Real aggregate exits 0 only after all four children settle once;
child counts are 52, 15, 16, and 6; aggregate has four unique execution keys and valid summary hashes. A
stubbed first-child rejection still lets all three siblings finish once, then exits non-zero without replay.

### V7 — Nx/npm and workflow topology

```powershell
node --test apps/dashboard-e2e/tools/wiring.spec.mjs
npx nx show project dashboard-e2e --json
```

Expected: 16/16 wiring tests; six explicit targets exist and are uncached; visual update is serialized;
quality has one command and no dependency. CI installs exactly three engines, invokes only the aggregate,
and always uploads four roots. Manual Linux candidates are dispatch-only, protected, contents-read,
upload-only, and unreachable from merge checks.

### V8 — Mutation completeness and safe artifacts

```powershell
node --test apps/dashboard-e2e/tools/mutations.spec.mjs
node --test apps/dashboard-e2e/tools/artifact-safety.spec.mjs
$env:BROWSER_QUALITY_BASE_REVISION='<pre-feature-40-hex>'
node --test apps/dashboard-e2e/tools/isolation.spec.mjs
```

Expected: 12/12 top-level mutations fail on poison and pass after hash restoration; artifact scans cover
successful and failing roots with no credential/account/production payload; the seeded canary is detected.
Isolation proves no product path outside the final exact D7/D8 source-and-test allowlist and no
backend/API/quant/public/runtime-dependency path or byte changed.

### V8A — D7 fixture/oracle repair evidence

```powershell
node --test apps/dashboard-e2e/tools/d7-fixture-repairs.spec.mjs
npx playwright test --config apps/dashboard-e2e/playwright.compat.config.ts --grep "signed-out|dense-positions|dense-scanner|stream-loss"
npx playwright test --config apps/dashboard-e2e/playwright.a11y.config.ts --grep "A11Y-B3|A11Y-B6|A11Y-B7"
```

Expected: all five AC34–38 controls pass. Scanner consumes a `{prices}` SSE envelope; the three seeded
position IDs survive initialization; the auth wall/dialog uses one anonymous session; offline remains
absent through 14,999 ms and appears at 15,000 ms; the isolated Chromium arm proves scale exactly 2 before
focus/reflow assertions. Reintroducing each diagnosed defect makes only its named mutation non-zero.

### V8B — D7 product accessibility and honest cold-error evidence

```powershell
npm run browser:a11y
npx nx test @convexa/dashboard
npx nx run @convexa/dashboard:lint
npx nx run @convexa/dashboard:typecheck
```

Expected: accessibility is exactly 16/16 (9 scans + 7 behaviors), with no serious/critical grip or named
contrast finding; Settings input accessible name is exactly `Default ticker`; skip activation focuses
`main#main-content` with path `/settings` and empty hash; cold HTTP 503 shows `API error 503` and `Retry`
with no fixture wording. Dashboard unit, lint, and typecheck targets exit 0. The diff contains no product
source outside the nine-file D7 allowlist.

### V8C — D7 boundary mutations and joined browser/build regression

```powershell
node --test apps/dashboard-e2e/tools/d7-boundary.spec.mjs
node --test apps/dashboard-e2e/tools/mutations.spec.mjs
$env:BROWSER_QUALITY_BASE_REVISION='<pre-feature-40-hex>'
node --test apps/dashboard-e2e/tools/isolation.spec.mjs
npm run browser:chromium
npm run browser:compat
npm run browser:a11y
npm run build:dashboard
npm run check:bundle
```

Expected: D7 boundary/mutation/isolation controls all pass; each AC29–38 reverse mutation is observed
failing before restoration; an adjacent product, token, route, public, API/backend/quant, or runtime-
dependency mutation is rejected. Real browser counts are 52/52, 15/15, and 16/16 with zero flaky/not-run;
dashboard production build and bundle check exit 0.

### V8D — D8 focused component, Chromium matrix, and final boundary evidence

```powershell
npx vitest run --config apps/dashboard/vite.config.mts apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx apps/dashboard/src/app/features/auth/auth.risk.spec.tsx
node --test apps/dashboard-e2e/tools/d8-boundary.spec.mjs
node --test apps/dashboard-e2e/tools/mutations.spec.mjs
$env:BROWSER_QUALITY_BASE_REVISION='<pre-feature-40-hex>'
node --test apps/dashboard-e2e/tools/isolation.spec.mjs
npx playwright test --config apps/dashboard-e2e/playwright.a11y.config.ts --project=chromium --grep "A11Y-3|A11Y-5|A11Y-6|A11Y-9|A11Y-B3|A11Y-B5|A11Y-B7"
npx playwright test --config apps/dashboard-e2e/playwright.compat.config.ts --project=chromium --grep "signed-out"
npm run browser:compat
npm run browser:a11y
```

Expected: every focused component and D8 boundary test passes; the focused Chromium arms observe one
Scanner-card link stop with preserved score description, all named Ticker/Positions contrast targets,
including `positions-disclosure` and every `tr-family-empty-*` node, valid position-trend help semantics,
exact opener restoration, and all three scale-2 viewport
intersections. The full collections remain 5 journeys × 3 engines and 9 scans + 7 behaviors, yielding
15/15 and 16/16 with zero skip/flaky/not-run. Reverting any one AC40–45 repair fails its exact mutation;
adjacent dashboard source, global token/theme, route, public, runtime dependency, API/backend/quant, matrix,
waiver, threshold, and tolerance poisons are rejected by the final exact-file allowlist.

### V9 — Full repository regression and empty interface proof

```powershell
npm run api:contract:check
npm run format:check
npm run lint
npm run typecheck
npm run test:tools
npm test
npm run build:dashboard
npm run check:bundle
node .codex/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/browser-quality-gates/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/browser-quality-gates/conformance-receipt-qa.json
```

Expected: all repository commands exit 0. The conformance tool reports the intentional empty endpoint set;
it does not require or claim a new endpoint. The receipt is QA-owned evidence, not a frontend implementation
artifact. Backend/API/quant/public/runtime-dependency trees remain unchanged; dashboard source differences
are confined to the exact D7/D8 source and co-located-test allowlist and the observable AC29–45
corrections.

### V10 — Formatting, current-platform evidence, and hosted honesty

```powershell
npx prettier --check package.json apps/dashboard-e2e .github/workflows/ci.yml .github/workflows/browser-visual-linux-candidates.yml apps/dashboard/src/app/shared/ui/Widget/Widget.tsx apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx apps/dashboard/src/app/features/auth/SettingsPage.tsx apps/dashboard/src/app/shell/AppShell.tsx apps/dashboard/src/app/pages/scanner/ScanCard.tsx apps/dashboard/src/app/pages/scanner/ScanCells.tsx apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx apps/dashboard/src/app/features/trading/positions/PositionRow.tsx apps/dashboard/src/app/features/trading/positions/PlSparkline.tsx apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx apps/dashboard/src/app/features/trading/positions/CustomizationToolbar.tsx apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx apps/dashboard/src/app/features/trading/positions/PositionCard.tsx apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx apps/dashboard/src/app/features/trading/positions/LegDisclosure.tsx apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx apps/dashboard/src/app/features/auth/RequireAuth.tsx apps/dashboard/src/app/features/auth/AuthDialogProvider.tsx apps/dashboard/src/app/features/auth/AuthDialog.tsx apps/dashboard/src/app/features/auth/auth.risk.spec.tsx
git diff --check
git status --short
```

Expected: formatting/diff checks pass; only planned paths plus pre-existing unrelated work appear. Two
current-platform compare receipts are distinct and byte-stable. No Linux baseline is synthesized on
Windows. Documentation and completion output contain the exact hosted NOT RUN line and no hosted PASS,
green, verified, approval, or equivalent claim until a real hosted execution exists.

## Acceptance coverage

| Criterion | Owning tasks | Verification |
|---|---|---|
| AC-1 | F0, F2 | V1, V3–V4 |
| AC-2 | F0 | V1 |
| AC-3 | F0, F3 | V1, V3 |
| AC-4 | F0, F4 | V3 |
| AC-5 | F2, F4 | V3, V8 |
| AC-6 | F0, F1, F5 | V2, V4 |
| AC-7 | F5 | V4 |
| AC-8 | F2, F5 | V4, V8 |
| AC-9 | F1, F5, F9D | V2, V4, V8D |
| AC-10 | F5 | V4, V8 |
| AC-11 | F0, F6, F10-frontend-closer | V5 |
| AC-12 | F1, F6, F10-frontend-closer | V5, V10 |
| AC-13 | F2, F6 | V5 |
| AC-14 | F6, F10-frontend-closer | V5 |
| AC-15 | F6, F10-frontend-closer | V5 |
| AC-16 | F6, F10-frontend-closer | V5, V10 |
| AC-17 | F6, F8, F10-frontend-closer | V5, V7, V10 |
| AC-18 | F8 | V7 |
| AC-19 | F7, F8 | V6–V7 |
| AC-20 | F0, F2, F3 | V1, V3 |
| AC-21 | F1, F2, F3, F4, F5, F6, F9A, F9D | V2–V5, V8, V8A, V8D |
| AC-22 | F2, F7 | V6, V8 |
| AC-23 | F1, F4, F5, F6, F9A | V2–V5, V8A |
| AC-24 | F7, F8 | V6–V7 |
| AC-25 | F0, F8, F10-frontend-closer | V7, V10 |
| AC-26 | F1, F2, F9 | V8 |
| AC-27 | F0, F9, F9B, F9C, F9D, F10-frontend-closer | V8, V8B–V10 |
| AC-28 | F0, F6, F10-frontend-closer | V5, V10 |
| AC-29 | F9B, F9C | V8B–V8C |
| AC-30 | F9B, F9C | V8B–V8C |
| AC-31 | F9B, F9C | V8B–V8C |
| AC-32 | F9B, F9C | V8B–V8C |
| AC-33 | F9A, F9B, F9C | V8A–V8C |
| AC-34 | F9A, F9C | V8A, V8C |
| AC-35 | F9A, F9C | V8A, V8C |
| AC-36 | F9A, F9C | V8A, V8C |
| AC-37 | F9A, F9C | V8A, V8C |
| AC-38 | F9A, F9C | V8A, V8C |
| AC-39 | F9C, F9D | V8C–V9 |
| AC-40 | F9D | V8D, V9–V10 |
| AC-41 | F9D | V8D, V9–V10 |
| AC-42 | F9D | V8D, V9–V10 |
| AC-43 | F9D | V8D, V9–V10 |
| AC-44 | F9D | V8D, V9–V10 |
| AC-45 | F9D | V8D, V9–V10 |

The coverage key set is exactly `AC-1` through `AC-45`, once per table row with no gap, duplicate, or
surplus. Before locking execution, run the structural check below and require `AC coverage: 45/45`:

```powershell
node -e "const fs=require('node:fs');const s=fs.readFileSync('.spire/clusters/tech/contracts/browser-quality-gates/PLAN.md','utf8');const rows=[...s.matchAll(/^\| AC-(\d+) \|/gm)].map(m=>Number(m[1]));const want=Array.from({length:45},(_,i)=>i+1);if(JSON.stringify(rows)!==JSON.stringify(want))throw new Error('AC coverage mismatch: '+rows.join(','));console.log('AC coverage: 45/45')"
```
