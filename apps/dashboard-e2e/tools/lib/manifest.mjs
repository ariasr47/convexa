import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './repository-root.mjs';
const MANIFEST_PATH = path.join(ROOT, 'apps', 'dashboard-e2e', 'src', 'quality', 'manifest.json');
const ROOT_KEYS = [
  'schema_version',
  'support_policy_id',
  'full_chromium',
  'compatibility',
  'accessibility',
  'visual',
  'artifact_roots',
];
const ID = /^[a-z0-9][a-z0-9._-]+$/;
const POSIX = /^[^\\]*$/;

const fail = (message) => {
  throw new Error(`Invalid browser quality manifest: ${message}`);
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(`${label} contains duplicate records`);
};

export function validateManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('root must be an object');
  const keys = Object.keys(value).sort();
  if (keys.join('|') !== [...ROOT_KEYS].sort().join('|')) fail('unknown or missing root keys');
  if (value.schema_version !== 1 || value.support_policy_id !== 'playwright-engines-1.62.1')
    fail('unsupported policy');
  const tests = value.full_chromium?.tests;
  if (
    // (curvature-v2-foundations FE-10) bumped from the frozen `pre-feature-52-v1`/52 baseline: FE-10
    // added 23 real Chromium tests (16 to `no-overflow.spec.ts` — AC-38/AC-39/AC-40/AC-57's `/alerts`
    // route, the `tablet 834` width, and 3 degraded-surface cases at 2 schemes — plus 7 new to
    // `curvature-v2.spec.ts`), so the frozen inventory this validator enforces moves with them.
    // (curvature-v2-desk-and-read FE-12) bumped 75 → 86: registered `desk-and-read.spec.ts` (6 new
    // tests — criterion 45's two, the criteria 20/22 evidence pair, criterion 52's two) and added 5
    // new criterion-50 read-strip-rail tests to `no-overflow.spec.ts` (393 dark/light, 834, 900,
    // 1280) — the first net-new Chromium tests this phase's own lanes have added (FE-1 through FE-11
    // only edited/re-pointed existing ones).
    // (curvature-v2-surfaces FE-12) bumped 86 → 90: U-32's frame-scoped `curvature-v2.spec.ts`
    // extension (SPEC §2.8, D-C) added a SECOND site list (all eight `widget-{id}` frame roots,
    // hero and live tape included) alongside the shipped `HOVER_INFO_WIDGETS` five — 4 new tests,
    // one per checked width (393/834/900/1280).
    // (curvature-v2-surfaces FE-13) bumped 90 → 99: 9 new tests — the 1280px light-scheme walk
    // over the four seeded surfaces (criterion 64, 6 tests, one per `ROUTES` entry), the
    // criterion 7a rendered-container-step review-evidence test (1), and the criterion 66 alerts
    // write-affordance describe block in `curvature-v2.spec.ts` (2).
    // (curvature-v2-surfaces GATE Z repair, findings 1-3) bumped 99 → 100: 1 new test — the
    // off-exchange proximity chip's 44px floor (`OffExchangeBlocks.tsx:113-123`), now reachable via
    // a local `/api/ticker/**` fixture override carrying real `off_exchange` block data (the shared
    // `bundle` fixtures in both e2e files had never carried this field, so the chip was previously
    // unrendered and untestable — FE-13's own "no reachable off-exchange bundle this session" note).
    // The two existing per-rule Remove/Switch tests were renamed (title_path updated, same test_id)
    // from "MEASURED, not asserted" to "GATE Z REPAIR" now that both controls are hard-asserted —
    // no new tests, no count change from that rename.
    // (curvature-v2-surfaces GATE Z repair pass 2, finding 3) bumped 100 → 103: 3 new tests in a new
    // `no-overflow.spec.ts` describe block (`GATE Z finding 3 (criterion 66)`), hard-asserting the
    // 44px coarse-pointer floor on `risk-inputs-account-size`/`risk-inputs-cap-value`,
    // `settings-ticker`/`settings-persona`, and the alerts composer's Symbol field + Kind select —
    // all newly reachable once `theme.ts`'s coarse-pointer selector was widened to `input` and
    // `[role="combobox"]`.
    // (curvature-v2-surfaces GATE Z repair pass 3, criterion 66 second clause) bumped 103 → 105:
    // `TrackRecordSection.tsx:226-231`'s `<summary>` on `/positions` was FIXED (this phase touches
    // the file, `bdc992d8` — unlike the three sibling under-floor `Select`s QA found on `/ticker`,
    // which stay itemized as carried debt, untouched this phase) — 2 new `no-overflow.spec.ts`
    // tests: the 393px/coarse floor assertion, and a 1280px/fine-pointer assertion proving the
    // local coarse-only `sx` never leaks into the desktop row height.
    // (curvature-v2-surfaces GATE Z repair pass 4, QA pass 3 Medium finding) bumped 105 → 108:
    // the pass-3 fix's `display: flex` silently removed the `<summary>`'s native `::marker`
    // (Chromium only generates it under `display: list-item`); pass 4 reaches the same 44px floor
    // with `line-height` instead, leaving `display` untouched. 3 new `no-overflow.spec.ts` tests —
    // 393px/coarse, 393px/fine (the direct QA comparison point) and 1280px/fine — each asserting
    // `getComputedStyle(summary).display === 'list-item'` (the mechanism the marker depends on,
    // verified to actually flip with the pass-3 defect) plus open/close/focus/Enter operability.
    // (curvature-v2-landing-and-site F15) bumped 108 → 126: `no-overflow.spec.ts`'s ROUTES table
    // gained /blog, /methodology and one unmatched path (AC-G3b), and ROUTES is iterated by six
    // loops — 393 dark, 393 light, tablet 834, md 900, lg 1280, and the lg-1280 light walk.
    // 3 routes × 6 loops = 18 net-new Chromium tests. Added coverage, not a breach of AC-G3.
    // (curvature-v2-landing-and-site GATE Z I-2, amendment 5) chromium count UNCHANGED at 126 —
    // this repair widens the ACCESSIBILITY scan matrix only (below), not `no-overflow.spec.ts`.
    value.full_chromium?.inventory_id !== 'curvature-v2-landing-and-site-126-v1' ||
    !Array.isArray(tests) ||
    tests.length !== 126
  )
    fail('full Chromium inventory must contain 126 tests');
  unique(
    tests.map((x) => x.test_id),
    'full Chromium tests',
  );
  for (const test of tests) {
    if (
      !/^[a-f0-9]{64}$/.test(test.test_id) ||
      test.project !== 'chromium' ||
      !POSIX.test(test.file) ||
      !test.file.startsWith('apps/dashboard-e2e/src/e2e/') ||
      !Array.isArray(test.title_path) ||
      test.title_path.some((x) => !x.trim())
    )
      fail('invalid Chromium test identity');
  }
  const journeys = value.compatibility?.journeys;
  if (
    !Array.isArray(journeys) ||
    journeys.length !== 5 ||
    JSON.stringify(value.compatibility.projects) !==
      JSON.stringify(['chromium', 'firefox', 'webkit'])
  )
    fail('compatibility inventory drift');
  unique(
    journeys.map((x) => x.id),
    'journeys',
  );
  for (const j of journeys)
    if (
      !ID.test(j.id) ||
      !['anonymous', 'authenticated'].includes(j.auth) ||
      !j.route.startsWith('/')
    )
      fail('invalid journey');
  const scans = value.accessibility?.scans;
  const behaviors = value.accessibility?.behaviors;
  if (
    !Array.isArray(scans) ||
    // (curvature-v2-landing-and-site F15) 9 → 12: AC-G1 requires the accessibility gate to cover the
    // six surfaces, and /blog, /methodology and the 404 had no scan. The id regex is widened with the
    // count — `A11Y-[1-9]` structurally rejected a tenth scan, which is why both move together.
    // (curvature-v2-landing-and-site GATE Z I-2, amendment 5) 12 → 24: the matrix is NAMED —
    // every one of the six surfaces (/, /blog, /methodology, the 404, the sign-in wall, the
    // degraded wall) in dark AND light at 393 (twelve combinations, two of which — blog/dark,
    // methodology/dark — already existed), the 404 stays additionally at 1280 (unchanged), and
    // the open sign-in dialog counts as a surface too, scanned in both schemes at 393. Twelve net
    // new scans. The id regex below moves with it.
    scans.length !== 24 ||
    !Array.isArray(behaviors) ||
    behaviors.length !== 7 ||
    value.accessibility.waiver_path !== 'apps/dashboard-e2e/src/quality/a11y-waivers.json'
  )
    fail('accessibility inventory drift');
  unique(
    scans.map((x) => x.id),
    'scans',
  );
  unique(
    behaviors.map((x) => x.id),
    'behaviors',
  );
  if (
    scans.some(
      (x) =>
        !/^A11Y-(?:[1-9]|1\d|2[0-4])$/.test(x.id) ||
        !Array.isArray(x.ready) ||
        !x.ready.length ||
        !Array.isArray(x.forbidden) ||
        !x.forbidden.length,
    )
  )
    fail('invalid scan readiness');
  if (behaviors.some((x) => !/^A11Y-B[1-7]$/.test(x.id) || x.project !== 'chromium'))
    fail('invalid accessibility behavior');
  const scenarios = value.visual?.scenarios;
  if (
    !Array.isArray(scenarios) ||
    scenarios.length !== 6 ||
    value.visual.project !== 'chromium' ||
    value.visual.threshold !== 0
  )
    fail('visual inventory drift');
  unique(
    scenarios.map((x) => x.id),
    'visual scenarios',
  );
  if (
    scenarios.some(
      (x) =>
        !ID.test(x.id) ||
        x.project !== 'chromium' ||
        !['dark', 'light'].includes(x.colorScheme) ||
        !Number.isInteger(x.viewport?.width) ||
        !Number.isInteger(x.viewport?.height),
    )
  )
    fail('invalid visual scenario');
  const expectedRoots = {
    chromium: 'apps/dashboard-e2e/test-output/playwright/chromium',
    compatibility: 'apps/dashboard-e2e/test-output/playwright/compatibility',
    accessibility: 'apps/dashboard-e2e/test-output/playwright/accessibility',
    visual: 'apps/dashboard-e2e/test-output/playwright/visual',
  };
  if (JSON.stringify(value.artifact_roots) !== JSON.stringify(expectedRoots))
    fail('artifact roots drift');
  return value;
}

export function loadManifest() {
  return validateManifest(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
}

export const manifestPath = MANIFEST_PATH;
