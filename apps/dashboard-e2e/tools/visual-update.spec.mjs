import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { loadManifest } from './lib/manifest.mjs';
import { ROOT, runCandidateUpdate } from './visual-update.mjs';

const updateEntrypoint = path.resolve('apps/dashboard-e2e/tools/visual-update.mjs');

test('real CLI resolves its repository root from a nested workspace, not cwd or apps', () => {
  const nestedWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-update-nested-'));
  const nestedCwd = path.join(nestedWorkspace, 'deep', 'child');
  fs.mkdirSync(nestedCwd, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { ROOT } from ${JSON.stringify(pathToFileURL(updateEntrypoint).href)}; console.log(ROOT);`,
    ],
    { cwd: nestedCwd, encoding: 'utf8', shell: false },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(path.resolve(result.stdout.trim()), path.resolve('.'));
  assert.equal(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8').includes('"name"'), true);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'apps/dashboard-e2e/src/quality/manifest.json')),
    true,
  );

  const escaped = spawnSync(
    process.execPath,
    [
      updateEntrypoint,
      '--authorization',
      'apps/dashboard-e2e/visual-review/authorizations/../outside.json',
    ],
    { cwd: nestedCwd, encoding: 'utf8', shell: false },
  );
  assert.equal(escaped.status, 1);
  assert.match(`${escaped.stdout}${escaped.stderr}`, /unsafe repository path/);
});

test('spawned Windows/canonical file-url entrypoint rejects invalid args and does not silently succeed', () => {
  const result = spawnSync(process.execPath, [updateEntrypoint], {
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 2);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /Candidate update requires exactly one --authorization path/,
  );
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /candidate-written|candidates_written/);
});

const makeFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-update-'));
  const manifest = loadManifest();
  const write = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return { path: relative, sha256: crypto.createHash('sha256').update(content).digest('hex') };
  };
  const summary = write('evidence/summary.json', 'failed');
  const scenarios = manifest.visual.scenarios.map((scenario) => {
    const actual = write(`evidence/${scenario.id}.actual`, scenario.id);
    return {
      scenario_id: scenario.id,
      expected_path: null,
      expected_sha256: null,
      actual_path: actual.path,
      actual_sha256: actual.sha256,
      diff_path: null,
      diff_sha256: null,
    };
  });
  const auth = {
    schema_version: 1,
    authorization_id: 'auth-update-1',
    decision: 'authorize_candidate_generation',
    state: 'authorized',
    actor: { id: 'owner', role: 'owner' },
    source_revision: 'a'.repeat(40),
    platform: 'win32',
    created_at: '2026-01-01T00:00:00.000Z',
    failed_compare: {
      run_id: 'failed-1',
      summary_path: summary.path,
      summary_sha256: summary.sha256,
    },
    scenarios,
  };
  write('apps/dashboard-e2e/visual-review/authorizations/auth-update-1.json', JSON.stringify(auth));
  return {
    root,
    manifest,
    relative: 'apps/dashboard-e2e/visual-review/authorizations/auth-update-1.json',
  };
};

test('candidate update uses private shell-free exact six selection and leaves human trees unchanged', () => {
  const fixture = makeFixture();
  const before = fs.readFileSync(path.join(fixture.root, fixture.relative));
  let invocation;
  const result = runCandidateUpdate({
    root: fixture.root,
    authorizationPath: fixture.relative,
    spawn: (command, args, options) => {
      invocation = { command, args, options };
      for (const scenario of fixture.manifest.visual.scenarios) {
        const file = path.join(
          fixture.root,
          'apps/dashboard-e2e/src/quality/snapshots/win32/chromium',
          `${scenario.id}.png`,
        );
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, scenario.id);
      }
      return { status: 0 };
    },
  });
  assert.equal(result.state, 'candidates_written');
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.env.BROWSER_QUALITY_AUTHORIZED_UPDATE, '1');
  assert.equal(
    invocation.options.env.BROWSER_QUALITY_VISUAL_SELECTION,
    fixture.manifest.visual.scenarios.map((x) => x.id).join(','),
  );
  assert.deepEqual(fs.readFileSync(path.join(fixture.root, fixture.relative)), before);
  assert.match(
    fs.readFileSync(
      path.join(
        fixture.root,
        'apps/dashboard-e2e/visual-review/candidate-sets',
        `${result.candidate_set_id}.json`,
      ),
      'utf8',
    ),
    /candidates_written/,
  );
});

test('candidate update rolls back partial or surplus writes', () => {
  const fixture = makeFixture();
  assert.throws(() =>
    runCandidateUpdate({
      root: fixture.root,
      authorizationPath: fixture.relative,
      spawn: (_command, _args, options) => {
        const file = path.join(
          fixture.root,
          'apps/dashboard-e2e/src/quality/snapshots/win32/chromium',
          `${fixture.manifest.visual.scenarios[0].id}.png`,
        );
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'partial');
        assert.equal(options.shell, false);
        return { status: 0 };
      },
    }),
  );
  assert.equal(
    fs.existsSync(
      path.join(
        fixture.root,
        'apps/dashboard-e2e/src/quality/snapshots/win32/chromium',
        `${fixture.manifest.visual.scenarios[0].id}.png`,
      ),
    ),
    false,
  );
});
