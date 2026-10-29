// The pre-push hook's release-version check (CLAUDE.md "Versions"; ledger row
// convexa-version-semver-per-push). A push to main is a release, and staging is fast-forwarded to
// main. Once v<version> tags a commit, a push of either branch at another commit would deploy new
// code under that released version, and with CI off nothing else would catch it (footer review,
// 2026-10-28). Each case builds a repository and a bare remote `origin` in a temporary directory
// and pushes from one to the other, so git itself writes the hook's stdin; one case writes the ref
// lines itself, to choose their order. The hook's later checks are stubs that log their calls
// (gitleaks and npx on PATH, the research-notes check in the scratch tree), so the cases also show
// that those checks still run, in order, after an allowed push, and that none runs after a refusal.
// Git here never reads this repository or the user's config.
// The hook under test is the `pre-push` beside this file. To watch the spec fail, copy this file
// next to another `pre-push` (a stub that always allows, or the hook before this check) and run it.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./pre-push', import.meta.url));
const ZERO = '0'.repeat(40);
// What the hook runs after its version check passes, in order: research notes, gitleaks, Nx.
const ALLOWED = { status: 0, said: [], checks: ['research-notes', 'gitleaks', 'npx'] };
const refused = (version, commit) => ({
  status: 1,
  said: [
    `pre-push: the version is already released as v${version} at ${commit}, so bump the root package.json version (see CLAUDE.md "Versions").`,
  ],
  checks: [],
});

// The hook and the stubs of its later checks are written once for all the cases: on macOS, a new
// executable's first run costs about 0.13 s, and writing the three per case took the spec from
// 5.2 s to 8.1 s.
const installed = {};
before(() => {
  installed.root = realpathSync(mkdtempSync(join(tmpdir(), 'pre-push-spec-')));
  installed.hook = join(installed.root, 'hooks', 'pre-push');
  installed.bin = join(installed.root, 'bin');
  mkdirSync(dirname(installed.hook));
  mkdirSync(installed.bin);
  copyFileSync(HOOK, installed.hook);
  chmodSync(installed.hook, 0o755);
  for (const tool of ['gitleaks', 'npx']) {
    writeFileSync(join(installed.bin, tool), `#!/bin/sh\necho ${tool} >> "$PRE_PUSH_SPEC_LOG"\n`);
    chmodSync(join(installed.bin, tool), 0o755);
  }
});
after(() => installed.root && rmSync(installed.root, { recursive: true, force: true }));

// A repository with a bare remote `origin` and the hook installed through core.hooksPath. No
// GIT_* variable is inherited (run from a git hook, GIT_DIR would aim every command here at this
// repository), HOME is the temporary directory, and the system config is off.
function scratch(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pre-push-spec-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const work = join(root, 'work');
  const remote = join(root, 'remote.git');
  const log = join(root, 'checks.log');
  mkdirSync(join(work, 'tools', 'research-notes'), { recursive: true });
  writeFileSync(
    join(work, 'tools', 'research-notes', 'check.mjs'),
    "import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.PRE_PUSH_SPEC_LOG, 'research-notes\\n');\n",
  );
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Spec',
    GIT_AUTHOR_EMAIL: 'spec@example.invalid',
    GIT_COMMITTER_NAME: 'Spec',
    GIT_COMMITTER_EMAIL: 'spec@example.invalid',
    PATH: [installed.bin, dirname(process.execPath), process.env.PATH].join(delimiter),
    PRE_PUSH_SPEC_LOG: log,
  };
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: work,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote], { env, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  assert.equal(git('rev-parse', '--show-toplevel'), work);
  git('config', 'core.hooksPath', dirname(installed.hook));
  git('remote', 'add', 'origin', remote);

  // The exit status, the lines the hook printed, and the later checks that ran.
  const run = (command, args, input) => {
    writeFileSync(log, '');
    const { status, stderr } = spawnSync(command, args, {
      cwd: work,
      env,
      encoding: 'utf8',
      input,
    });
    return {
      status,
      said: stderr.split('\n').filter((line) => line.startsWith('pre-push:')),
      checks: readFileSync(log, 'utf8').split('\n').filter(Boolean),
    };
  };
  // The root package.json, shaped like this repository's; `version: null` leaves the field out.
  const manifest = (version) => {
    const fields = { name: '@convexa/source', version: version ?? undefined, private: true };
    writeFileSync(join(work, 'package.json'), `${JSON.stringify(fields, null, 2)}\n`);
  };
  return {
    git,
    manifest,
    short: (commit) => git('rev-parse', '--short', commit),
    // A commit with `version` in the root package.json and a code change.
    commit(version, label) {
      manifest(version);
      writeFileSync(join(work, 'code.txt'), `${label}\n`);
      git('add', 'package.json', 'code.txt');
      git('commit', '-q', '-m', label);
      return git('rev-parse', 'HEAD');
    },
    tag: (name, commit, { annotated }) =>
      annotated ? git('tag', '-a', '-m', name, name, commit) : git('tag', name, commit),
    // `git push -q origin <refspecs>`: git runs the hook and writes its stdin.
    push: (...refspecs) => run('git', ['push', '-q', 'origin', ...refspecs]),
    // The hook run directly, as git runs it, with these ref lines on stdin.
    hook: (lines) =>
      run(installed.hook, ['origin', remote], lines.map((line) => `${line.join(' ')}\n`).join('')),
    // Where the remote's ref points, or null.
    remote: (ref) =>
      spawnSync('git', ['--git-dir', remote, 'rev-parse', '-q', '--verify', ref], {
        env,
        encoding: 'utf8',
      }).stdout.trim() || null,
  };
}

describe('pre-push refuses a push of main or staging that reuses a released version', () => {
  it('allows the first push of a version: no tag v<version> yet, as at the v1.0.0 release', (t) => {
    const s = scratch(t);
    const a = s.commit('1.0.0', 'A');
    assert.deepEqual(s.push('main'), ALLOWED);
    assert.equal(s.remote('refs/heads/main'), a);
    s.tag('v1.0.0', a, { annotated: true });
    const b = s.commit('1.0.1', 'B: a fix, bumped');
    assert.deepEqual(s.push('main', 'main:staging'), ALLOWED);
    assert.equal(s.remote('refs/heads/main'), b);
    assert.equal(s.remote('refs/heads/staging'), b);
  });

  it('allows a push of main or staging at the commit v<version> tags', (t) => {
    const s = scratch(t);
    s.commit('1.0.0', 'A');
    s.push('main');
    const b = s.commit('1.1.0', 'B: a feature, bumped');
    // Tagged before the push. An annotated tag is its own object: the hook compares its commit.
    s.tag('v1.1.0', b, { annotated: true });
    assert.deepEqual(s.push('main'), ALLOWED);
    // After the release, staging is fast-forwarded to it.
    assert.deepEqual(s.push('main:staging'), ALLOWED);
    assert.equal(s.remote('refs/heads/main'), b);
    assert.equal(s.remote('refs/heads/staging'), b);
  });

  it('refuses a push of main or staging when v<version> tags another commit, before the other checks', (t) => {
    const s = scratch(t);
    const a = s.commit('1.0.0', 'A');
    s.push('main', 'main:staging');
    s.tag('v1.0.0', a, { annotated: true });
    s.commit('1.0.0', 'B: new code, not bumped');
    for (const refspec of ['main', 'main:staging']) {
      assert.deepEqual(s.push(refspec), refused('1.0.0', s.short(a)), refspec);
    }
    assert.equal(s.remote('refs/heads/main'), a);
    assert.equal(s.remote('refs/heads/staging'), a);
    // A lightweight tag counts the same.
    const c = s.commit('1.0.1', 'C: bumped');
    assert.deepEqual(s.push('main'), ALLOWED);
    s.tag('v1.0.1', c, { annotated: false });
    s.commit('1.0.1', 'D: new code, not bumped');
    assert.deepEqual(s.push('main'), refused('1.0.1', s.short(c)));
    assert.equal(s.remote('refs/heads/main'), c);
  });

  it('reads the version at the pushed commit, not at HEAD or in the working tree', (t) => {
    const s = scratch(t);
    const a = s.commit('1.0.0', 'A');
    s.push('main');
    s.tag('v1.0.0', a, { annotated: true });
    const b = s.commit('1.0.0', 'B: new code, not bumped');
    s.git('switch', '-q', '-c', 'next');
    const c = s.commit('1.0.1', 'C: bumped');
    // Pushed: C, whose 1.0.1 no tag names. HEAD and the working tree: B, with the released 1.0.0.
    s.git('switch', '-q', 'main');
    assert.deepEqual(s.push('next:main'), ALLOWED);
    assert.equal(s.remote('refs/heads/main'), c);
    // Pushed: B, released at A. HEAD: C (1.0.1), and the working tree an uncommitted 1.0.2.
    s.git('switch', '-q', 'next');
    s.manifest('1.0.2');
    assert.deepEqual(s.push(`${b}:refs/heads/staging`), refused('1.0.0', s.short(a)));
    assert.equal(s.remote('refs/heads/staging'), null);
  });

  it('checks each ref of a push, on any line, and only main and staging', (t) => {
    const s = scratch(t);
    const a = s.commit('1.0.0', 'A');
    s.push('main');
    s.tag('v1.0.0', a, { annotated: true });
    const b = s.commit('1.0.0', 'B: new code, not bumped');
    // Another branch passes, whatever its version.
    assert.deepEqual(s.push('main:feature'), ALLOWED);
    // One refused ref fails the whole push, and nothing lands.
    assert.deepEqual(s.push('main:other', 'main'), refused('1.0.0', s.short(a)));
    assert.equal(s.remote('refs/heads/other'), null);
    // Git orders the lines itself, so here they are written out: a tag and a new branch, then a
    // release branch on the last line.
    const tag = ['refs/tags/v1.0.0', s.git('rev-parse', 'v1.0.0'), 'refs/tags/v1.0.0', ZERO];
    const docs = ['refs/heads/docs', b, 'refs/heads/docs', ZERO];
    assert.deepEqual(s.hook([tag, docs]), ALLOWED);
    for (const release of ['refs/heads/main', 'refs/heads/staging']) {
      const lines = [tag, docs, ['refs/heads/main', b, release, a]];
      assert.deepEqual(s.hook(lines), refused('1.0.0', s.short(a)), release);
    }
  });

  it('allows a push that only sends tags, or deletes a ref', (t) => {
    const s = scratch(t);
    const a = s.commit('1.0.0', 'A');
    s.push('main', 'main:staging');
    s.tag('v1.0.0', a, { annotated: true });
    const b = s.commit('1.0.0', 'B: new code, not bumped');
    s.tag('b-backup', b, { annotated: false });
    // A push of main is refused here, but these move no branch.
    assert.deepEqual(s.push('v1.0.0', 'b-backup'), ALLOWED);
    assert.equal(s.remote('refs/tags/b-backup'), b);
    assert.deepEqual(s.push('--delete', 'staging'), ALLOWED);
    assert.equal(s.remote('refs/heads/staging'), null);
    assert.deepEqual(s.hook([['(delete)', ZERO, 'refs/heads/main', a]]), ALLOWED);
    assert.deepEqual(s.push('main'), refused('1.0.0', s.short(a)));
  });

  it('refuses a push of main or staging whose root package.json has no version', (t) => {
    const s = scratch(t);
    const a = s.commit(null, 'A: no version');
    for (const [refspec, ref] of [
      ['main', 'refs/heads/main'],
      ['main:staging', 'refs/heads/staging'],
    ]) {
      assert.deepEqual(
        s.push(refspec),
        {
          status: 1,
          said: [
            `pre-push: no version in the root package.json at ${s.short(a)}; not pushing ${ref}.`,
          ],
          checks: [],
        },
        refspec,
      );
    }
    assert.deepEqual(s.push('main:feature'), ALLOWED);
  });
});
