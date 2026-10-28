// What `npm run verify` lints, typechecks and tests for a change (planProjects, planChanges and
// changedFiles in verify.mjs). Verify is the only gate while CI is off, and a scheduling slip there
// skips tests silently: the FE review of 2026-10-28 found @convexa/api's error-code spec, which
// reads the API's auth service, never scheduled for a change to that service. The graph below
// copies the shape `nx graph --print` gives and this workspace's inputs, cut to what each case
// needs. Only the last block touches git, in a temporary repository; nothing runs Nx.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { changedFiles, planChanges, planProjects } from './verify.mjs';

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
        '{workspaceRoot}/apps/dashboard/src/app/shared/dataState/vocabulary.ts',
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
      ],
    },
  }),
  '@convexa/dashboard': project('apps/dashboard', {
    lint: { inputs: ['default'] },
    typecheck: { inputs: ['default', '^production'] },
    test: { inputs: ['default', '^production', VITEST, '{workspaceRoot}/research/**/*'] },
  }),
  'dashboard-e2e': project('apps/dashboard-e2e', {
    lint: { inputs: ['default'] },
    typecheck: { inputs: ['default', '^production'] },
  }),
};
const SERVICE = 'apps/api/src/services/auth/service.rs';
const plan = (changed, affected, nodes = NODES) =>
  planProjects({ changed, nodes, namedInputs: NAMED_INPUTS, affected });
const withTestInputs = (inputs) => ({
  ...NODES,
  probe: project('tools/probe', { test: { inputs: ['{projectRoot}/**/*', ...inputs] } }),
});

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
    // CACHE_ONLY_INPUTS.
    for (const file of ['apps/dashboard/src/main.tsx', 'apps/dashboard/src/styles.css']) {
      const { run, skipped } = plan([file], ['@convexa/dashboard', 'dashboard-e2e', 'api']);
      assert.deepEqual(run, ['@convexa/dashboard', 'dashboard-e2e'], file);
      assert.deepEqual(skipped, ['api'], file);
    }
  });

  it('runs api for a dashboard file that api:test also lists on its own', () => {
    // A Rust test compiles vocabulary.ts in (include_str!), so a moved or edited file must run api,
    // though the held glob covers it too.
    const file = 'apps/dashboard/src/app/shared/dataState/vocabulary.ts';
    const { run, skipped, scheduled } = plan(
      [file],
      ['@convexa/dashboard', 'dashboard-e2e', 'api'],
    );
    assert.deepEqual(run, ['@convexa/dashboard', 'api', 'dashboard-e2e']);
    assert.deepEqual(skipped, []);
    assert.deepEqual(scheduled.api, [{ file, input: `{workspaceRoot}/${file}` }]);
  });

  it('runs api when a dashboard source and another api:test input change together', () => {
    const { run } = plan(
      ['apps/dashboard/src/main.tsx', 'Cargo.lock'],
      ['@convexa/dashboard', 'dashboard-e2e', 'api'],
    );
    assert.deepEqual(run, ['@convexa/dashboard', 'api', 'dashboard-e2e']);
  });
});

describe('verify fails rather than plan from an input it cannot follow', () => {
  it('fails when a held input is not spelled as one of the project test inputs', () => {
    // Respelled to a glob that names the same files for Nx, the held string matches no input, so
    // nothing is held, and cargo test (~7 minutes) would run for every dashboard edit.
    const nodes = structuredClone(NODES);
    const inputs = nodes.api.data.targets.test.inputs;
    inputs[inputs.indexOf('{workspaceRoot}/apps/dashboard/src/**/*')] =
      '{workspaceRoot}/apps/dashboard/src/**';
    assert.throws(
      () => plan(['apps/dashboard/src/styles.css'], [], nodes),
      /holds \{workspaceRoot\}\/apps\/dashboard\/src\/\*\*\/\* for api, but api:test has no input spelled that way/,
    );
    const withoutApi = Object.fromEntries(Object.entries(NODES).filter(([name]) => name !== 'api'));
    assert.throws(() => plan([], [], withoutApi), /names api, which has no test target/);
  });

  it('fails when a held project has dependency inputs', () => {
    // A held project runs only when one of its own inputs changed, so a change to a dependency
    // alone, which only Nx's affected list shows, would skip it.
    assert.throws(
      () =>
        planProjects({
          changed: ['libs/api/src/lib/convexa.ts'],
          nodes: NODES,
          namedInputs: NAMED_INPUTS,
          affected: ['@convexa/api', '@convexa/dashboard', 'dashboard-e2e'],
          cacheOnly: { '@convexa/dashboard': ['{workspaceRoot}/research/**/*'] },
        }),
      /holds @convexa\/dashboard, but @convexa\/dashboard:test has dependency inputs/,
    );
  });

  it('fails on a test input that names no files it can match, and keys only the cache otherwise', () => {
    // dependentTasksOutputFiles: another task's outputs, which no project-graph edge may reach (as
    // with dependsOn alone). `filesets` is a typo of `fileset`.
    for (const input of [
      { dependentTasksOutputFiles: '**/*.d.ts', transitive: true },
      { filesets: '{workspaceRoot}/fixtures/case.json' },
    ]) {
      assert.throws(
        () => plan(['tools/probe/main.mjs'], [], withTestInputs([input])),
        /probe:test has an input verify cannot plan for/,
      );
    }
    const keysOnly = withTestInputs([{ runtime: 'node --version' }, { env: 'CI' }, VITEST]);
    assert.deepEqual(plan(['tools/probe/main.mjs'], [], keysOnly).run, ['probe']);
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

describe('verify reads the changed files from git and the affected projects from Nx', () => {
  it('lists committed, staged, unstaged, untracked, deleted and moved files, each path as it is', (t) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'verify-changes-')));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const git = (...args) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const write = (file, text) => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    };
    git('init', '-q');
    // Non-ASCII names, as escapes: one tracked and edited (git diff), one new (git ls-files).
    const edited = 'apps/dashboard/src/a\u00f1o.ts';
    const added = 'apps/dashboard/src/caf\u00e9.tsx';
    const base = [
      'libs/api/src/moved.ts',
      'apps/api/src/removed.rs',
      'apps/api/src/staged.rs',
      'apps/dashboard/src/unstaged.tsx',
      edited,
      'docs/unchanged.md',
      '.gitignore',
    ];
    for (const file of base) write(file, file === '.gitignore' ? 'out/\n' : 'base\n');
    git('add', '-A');
    // `git diff <tree>` compares the working tree with a tree as with a commit; no commit needed.
    const tree = git('write-tree').trim();
    git('mv', 'libs/api/src/moved.ts', 'libs/api/src/renamed.ts');
    rmSync(join(root, 'apps/api/src/removed.rs'));
    write('apps/api/src/staged.rs', 'staged\n');
    git('add', 'apps/api/src/staged.rs');
    write('apps/dashboard/src/unstaged.tsx', 'unstaged\n');
    write(edited, 'edited\n');
    write(added, 'new\n');
    write('apps/dashboard/src/with space.ts', 'new\n');
    write('out/ignored.txt', 'ignored\n');

    const nfc = (files) => files.map((file) => file.normalize('NFC')).sort();
    assert.deepEqual(
      nfc(changedFiles(tree, root)),
      nfc([
        'apps/api/src/removed.rs',
        'apps/api/src/staged.rs',
        edited,
        added,
        'apps/dashboard/src/unstaged.tsx',
        'apps/dashboard/src/with space.ts',
        'libs/api/src/moved.ts',
        'libs/api/src/renamed.ts',
      ]),
    );
  });

  it("gives planProjects Nx's affected list, from a diff against the base or the --files list", () => {
    const calls = [];
    const nx = (args, open, input) => {
      calls.push({ args, open, input });
      return args[1] === 'graph'
        ? { graph: { nodes: NODES } }
        : ['@convexa/api', '@convexa/dashboard', 'dashboard-e2e'];
    };
    const changed = ['libs/api/src/lib/convexa.ts'];
    const affected = ['nx', 'show', 'projects', '--affected', '--json'];
    // The dashboard reaches libs/api only through ^production: Nx's affected list alone brings it in.
    const expected = ['@convexa/api', '@convexa/dashboard', 'dashboard-e2e'];
    const fromBase = planChanges(changed, { base: 'b4se', nx, namedInputs: NAMED_INPUTS });
    assert.deepEqual(fromBase.run, expected);
    assert.deepEqual(calls.at(-1), {
      args: [...affected, '--base=b4se'],
      open: '[',
      input: undefined,
    });
    const fromFiles = planChanges(changed, { files: true, nx, namedInputs: NAMED_INPUTS });
    assert.deepEqual(fromFiles.run, expected);
    assert.deepEqual(calls.at(-1), {
      args: [...affected, '--stdin'],
      open: '[',
      input: changed[0],
    });
    calls.length = 0;
    assert.deepEqual(planChanges([], { base: 'b4se', nx, namedInputs: NAMED_INPUTS }).run, []);
    assert.deepEqual(
      calls.map(({ args }) => args.join(' ')),
      ['nx graph --print'],
    );
  });
});
