#!/usr/bin/env node
/**
 * Link this checkout's own workspace packages into its `node_modules/@org`.
 *
 * The worktree gotcha (found 2026-08-04): a `.claude/worktrees/<name>` checkout gets an EMPTY
 * `node_modules/`. Node resolution then walks UP to the main repo's, which is what makes
 * worktrees cheap — react/vitest/tsc all resolve fine. But `node_modules/@org` lives up there
 * too, so `@org/api` resolves to the MAIN checkout's `libs/api`, not this one. Two bites:
 *
 *   1. Nx's project graph can't map the import back to THIS checkout's `@org/api` project, so
 *      the `libs/api/tsconfig.lib.json` reference in `apps/dashboard/tsconfig.app.json` looks
 *      STALE. `nx sync` then offers to delete a reference that is correct in the main checkout,
 *      and every target dies on the out-of-sync gate first. `--skip-sync` silences the gate but
 *      leaves (2) in place, which is the one that actually bites.
 *   2. You silently typecheck/build/test against the MAIN checkout's lib source. Invisible while
 *      the two agree; a lie the moment they diverge — which is the entire point of a worktree.
 *
 * Junctions (not symlinks) so this needs no admin and no Developer Mode. `node_modules` is
 * gitignored, so nothing here is a tracked change.
 *
 * Usage:  node tools/link-workspace.mjs
 *         npm run worktree:link
 *
 * Idempotent — an existing correct link is a success. Run `npx nx reset` afterwards: the cached
 * project graph outlives the junctions and will keep reporting the stale reference until it is
 * cleared. This script does that for you.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every workspace package, discovered from the root package.json globs (`apps/*`, `libs/*`). */
const globs = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces ?? [];
const packages = globs
  .map((g) => g.replace(/\/\*$/, ''))
  .filter((dir) => existsSync(join(root, dir)))
  .flatMap((dir) =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(root, dir, e.name, 'package.json')))
      .map((e) => join(dir, e.name)),
  )
  .map((rel) => ({
    rel,
    name: JSON.parse(readFileSync(join(root, rel, 'package.json'), 'utf8')).name,
  }))
  .filter((p) => p.name?.startsWith('@org/'));

if (!packages.length) {
  console.error('No @org/* workspace packages found — is this the workspace root?');
  process.exit(1);
}

let linked = 0;
for (const { rel, name } of packages) {
  const link = join(root, 'node_modules', name);
  const target = join(root, rel);
  mkdirSync(dirname(link), { recursive: true });

  // An existing link pointing at the MAIN repo (or anywhere else) is exactly the bug — replace it.
  // `realpath`, not `resolve`: only the former follows the junction to what it actually points at,
  // which is the whole question being asked here.
  if (existsSync(link)) {
    let current = null;
    try {
      current = realpathSync(link);
    } catch {
      /* dangling link — fall through and recreate */
    }
    if (current === realpathSync(target)) {
      console.log(`  ok    ${name} -> ${rel}`);
      continue;
    }
    rmSync(link, { recursive: true, force: true });
  }

  execSync(`mklink /J "${link}" "${target}"`, { shell: 'cmd.exe', stdio: 'ignore' });
  console.log(`  link  ${name} -> ${rel}`);
  linked++;
}

// The graph cache is computed from the OLD resolution; without this the stale-reference report
// survives the fix and it looks like the junctions did nothing.
if (linked) {
  console.log('\nResetting the Nx project graph cache...');
  execSync('npx nx reset', { cwd: root, stdio: 'ignore' });
}

console.log(
  `\n${linked ? `Linked ${linked} package(s).` : 'Already linked.'} ` +
    'Verify with: npx nx sync:check',
);
