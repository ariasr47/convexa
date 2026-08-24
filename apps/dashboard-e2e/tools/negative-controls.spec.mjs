import assert from 'node:assert/strict';
import test from 'node:test';
import { loadManifest } from './lib/manifest.mjs';
import { validateSummary } from './lib/summary.mjs';

const manifest = loadManifest();
const common = {
  schema_version: 1,
  run_id: 'negative-control',
  source_revision: 'a'.repeat(40),
  selected: 0,
  executed: 0,
  passed: 0,
  failed: 0,
  flaky: 0,
  not_run: 0,
  status: 'fail',
  playwright_version: '1.62.1',
  browser_revision: '1234',
  host_platform: 'win32',
  artifacts: [],
};

test('compatibility negative control is non-zero and retains the failed arm identity', () => {
  const summary = {
    ...common,
    gate: 'compatibility',
    selected: 15,
    executed: 15,
    failed: 1,
    arms: [
      {
        identity: ['compatibility', 'chromium', 'ticker-stream-loss'],
        journey_id: 'ticker-stream-loss',
        engine: 'chromium',
        project: 'chromium',
        file: 'apps/dashboard-e2e/src/quality/compatibility.spec.ts',
        status: 'failed',
        retry: 0,
        artifact_paths: [],
      },
    ],
  };
  assert.throws(
    () => validateSummary(summary, { manifest }),
    /invalid count arithmetic|compatibility inventory/,
  );
  assert.equal(summary.arms[0].journey_id, 'ticker-stream-loss');
});

test('visual negative controls reject missing scenario and changed artifact evidence', () => {
  const scenarios = manifest.visual.scenarios.map((scenario) => ({
    identity: ['visual', scenario.id],
    scenario_id: scenario.id,
    file: 'apps/dashboard-e2e/src/quality/visual.spec.ts',
    project: 'chromium',
    status: 'passed',
    retry: 0,
    expected_path: `apps/dashboard-e2e/src/quality/snapshots/win32/chromium/${scenario.id}.png`,
    expected_sha256: 'a'.repeat(64),
    actual_path: `apps/dashboard-e2e/test-output/${scenario.id}.png`,
    actual_sha256: 'b'.repeat(64),
    diff_path: null,
    diff_sha256: null,
    artifact_paths: [],
  }));
  assert.throws(
    () =>
      validateSummary(
        { ...common, gate: 'visual', selected: 6, scenarios: scenarios.slice(0, 5) },
        { manifest },
      ),
    /invalid count arithmetic|visual inventory/,
  );
  scenarios[0].actual_sha256 = 'c'.repeat(64);
  assert.throws(
    () => validateSummary({ ...common, gate: 'visual', selected: 6, scenarios }, { manifest }),
    /invalid count arithmetic|visual artifact hash/,
  );
});
