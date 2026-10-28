// What `npm run verify` lints, typechecks and tests for a change (planProjects in verify.mjs).
// Verify is the only gate while CI is off, and a scheduling slip there skips tests silently: the
// FE review of 2026-10-28 found @convexa/api's error-code spec, which reads the API's auth service,
// never scheduled for a change to that service (its contract-authority spec scans the dashboard
// sources the same way). The graph below copies the shape `nx graph --print` gives and this
// workspace's inputs, cut to what each case needs. No Nx, git or file access.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planProjects } from './verify.mjs';

const NAMED_INPUTS = {
  default: ['{projectRoot}/**/*', 'sharedGlobals'],
  production: ['default', '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'],
  sharedGlobals: ['{workspaceRoot}/tsconfig.base.json', { runtime: 'node --version' }],
};
const VITEST = { externalDependencies: ['vitest'] };
const project = (root, targets) => ({ data: { root, targets } });
const NODES = {
  api: project('apps/api', {
    test: {
      inputs: [
        '{projectRoot}/**/*',
        '{workspaceRoot}/libs/quant-engine/**/*',
        '{workspaceRoot}/libs/api/src/generated/**/*',
        '{workspaceRoot}/apps/dashboard/src/**/*',
        '{workspaceRoot}/.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json',
        '{workspaceRoot}/docs/ENVIRONMENTS.md',
        '{workspaceRoot}/Cargo.lock',
        { runtime: 'rustc --version' },
      ],
    },
  }),
  '@convexa/api': project('libs/api', {
    lint: { inputs: ['default'] },
    typecheck: { inputs: ['default', '^production'] },
    test: {
      inputs: [
        'default',
        '^production',
        VITEST,
        '{workspaceRoot}/apps/api/src/services/auth/service.rs',
        '{workspaceRoot}/apps/dashboard/src/**/*.{ts,tsx}',
      ],
    },
  }),
  '@convexa/dashboard': project('apps/dashboard', {
    lint: { inputs: ['default'] },
    typecheck: { inputs: ['default', '^production'] },
    test: { inputs: ['default', '^production', VITEST] },
  }),
  'dashboard-e2e': project('apps/dashboard-e2e', {
    lint: { inputs: ['default'] },
    typecheck: { inputs: ['default', '^production'] },
  }),
};
const SERVICE = 'apps/api/src/services/auth/service.rs';
const plan = (changed, affected, nodes = NODES) =>
  planProjects({ changed, nodes, namedInputs: NAMED_INPUTS, affected });

describe('verify schedules a test when one of its inputs changes', () => {
  it('runs a test whose inputs list a changed file in another project', () => {
    // Nx 23 names @convexa/api here once the input is declared, but verify does not rely on it:
    // `affected` is what Nx returned before (FE review: only ["api"]).
    const { run, scheduled } = plan([SERVICE], ['api']);
    assert.deepEqual(run, ['@convexa/api', 'api']);
    assert.deepEqual(scheduled['@convexa/api'], [
      { file: SERVICE, input: `{workspaceRoot}/${SERVICE}` },
    ]);
  });

  it('runs api for every api:test input, not only Rust paths', () => {
    for (const file of [
      'docs/ENVIRONMENTS.md',
      '.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json',
      'libs/quant-engine/src/lib.rs',
    ]) {
      assert.deepEqual(plan([file], ['api']).run, ['api'], file);
    }
  });

  it('matches dotfiles and deleted files, as Nx hashes and diffs them', () => {
    // An empty `affected` isolates verify's own match. Nx hashes apps/api/.env.example as an
    // api:test input, and a deleted file still appears in the diff.
    assert.deepEqual(plan(['apps/api/.env.example'], []).run, ['api']);
    assert.deepEqual(plan(['libs/quant-engine/tests/fixtures/.gitkeep'], []).run, ['api']);
    assert.deepEqual(plan(['apps/api/tests/fixtures/removed-case.json'], []).run, ['api']);
  });

  it('expands named inputs, and leaves dependency and exclusion inputs to the affected graph', () => {
    // tsconfig.base.json reaches every TS test through default, then sharedGlobals.
    assert.deepEqual(Object.keys(plan(['tsconfig.base.json'], []).scheduled).sort(), [
      '@convexa/api',
      '@convexa/dashboard',
    ]);
    // A spec file is excluded from production, but test uses default: the exclusion never applies.
    assert.deepEqual(plan(['libs/api/src/lib/convexa.spec.ts'], []).run, ['@convexa/api']);
    // @convexa/api's source reaches the dashboard only through ^production, and Nx's affected
    // graph names the dashboard for that; verify's own match adds nothing.
    assert.equal(
      plan(['libs/api/src/lib/convexa.ts'], []).scheduled['@convexa/dashboard'],
      undefined,
    );
  });

  it('reads a named input of another project, filesets and JSON files as patterns', () => {
    const nodes = {
      ...NODES,
      probe: project('tools/probe', {
        test: {
          inputs: [
            { input: 'default', projects: ['api'] },
            { fileset: '{workspaceRoot}/fixtures/*.json' },
            { json: '{workspaceRoot}/config/app.json', fields: ['mode'] },
            { input: 'default', dependencies: true },
          ],
        },
      }),
    };
    const reaches = (file) => 'probe' in plan([file], [], nodes).scheduled;
    assert.equal(reaches('apps/api/src/main.rs'), true);
    assert.equal(reaches('fixtures/case.json'), true);
    assert.equal(reaches('config/app.json'), true);
    assert.equal(reaches('fixtures/deeper/case.json'), false);
    assert.equal(reaches('tools/probe/README.md'), false);
  });
});

describe('verify keeps a costly test out unless its own inputs changed', () => {
  it('skips api for a dashboard-only change, though api:test hashes the dashboard sources', () => {
    // Nx names api here (api:test lists apps/dashboard/src), and verify holds it back:
    // CACHE_ONLY_INPUTS. @convexa/api runs, as its contract-authority spec reads .ts and .tsx
    // dashboard sources; `affected` is what Nx returned before that input was declared.
    const dashboardOnly = ['@convexa/dashboard', 'dashboard-e2e', 'api'];
    const source = plan(['apps/dashboard/src/main.tsx'], dashboardOnly);
    assert.deepEqual(source.run, ['@convexa/api', '@convexa/dashboard', 'dashboard-e2e']);
    assert.deepEqual(source.skipped, ['api']);
    const style = plan(['apps/dashboard/src/styles.css'], dashboardOnly);
    assert.deepEqual(style.run, ['@convexa/dashboard', 'dashboard-e2e']);
    assert.deepEqual(style.skipped, ['api']);
  });

  it('runs api when a dashboard source and another api:test input change together', () => {
    const { run } = plan(
      ['apps/dashboard/src/main.tsx', 'Cargo.lock'],
      ['@convexa/dashboard', 'dashboard-e2e', '@convexa/api', 'api'],
    );
    assert.deepEqual(run, ['@convexa/api', '@convexa/dashboard', 'api', 'dashboard-e2e']);
  });
});

describe('verify hands Nx an exact project list', () => {
  it('runs @convexa/api for its own change, and names every project exactly', () => {
    // `nx affected --exclude=api` dropped @convexa/api here: with api absent from the affected
    // graph, Nx matched "api" as a word inside "@convexa/api" (find-matching-projects.js).
    const { run, args } = plan(
      ['libs/api/src/lib/convexa.ts'],
      ['@convexa/api', '@convexa/dashboard', 'dashboard-e2e'],
    );
    assert.deepEqual(run, ['@convexa/api', '@convexa/dashboard', 'dashboard-e2e']);
    assert.deepEqual(args, [
      'nx',
      'run-many',
      '-t',
      'lint',
      'typecheck',
      'test',
      '-p',
      '@convexa/api,@convexa/dashboard,dashboard-e2e',
    ]);
  });

  it('runs nothing when nothing changed', () => {
    // `nx run-many` without projects runs every project, api included.
    const { run, args } = plan([], []);
    assert.deepEqual(run, []);
    assert.equal(args, null);
  });
});
