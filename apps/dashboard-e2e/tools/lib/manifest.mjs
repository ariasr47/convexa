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
    value.full_chromium?.inventory_id !== 'pre-feature-52-v1' ||
    !Array.isArray(tests) ||
    tests.length !== 52
  )
    fail('full Chromium inventory must contain 52 tests');
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
    scans.length !== 9 ||
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
        !/^A11Y-[1-9]$/.test(x.id) ||
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
