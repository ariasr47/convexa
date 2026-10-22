#!/usr/bin/env node
/**
 * `npm run atlas`: regenerate the repo atlas (docs/atlas/index.html) from a clean export of a
 * commit, never from the working tree, so uncommitted edits cannot leak into it.
 *
 *   1. Resolve --ref (default HEAD) to a full sha and its commit date: the page's only stamp.
 *   2. `git archive <sha> | tar -x` into a scratch folder under the OS temp dir, and give it a
 *      node_modules of symlinks to this checkout's packages. Workspace packages (@convexa/*) point
 *      at the export's own folders, so the build reads the commit's libs/api, not the working tree's.
 *   3. Build the dashboard there four times: unminified demo and live builds for the recorders
 *      (component names survive), and the production demo and live builds for the "On the wire"
 *      waterfall and the bundle numbers (the project's own check-dashboard-bundle.mjs).
 *   4. Index every tracked file (`git ls-tree -r <sha>`) from the export (index-files.mjs).
 *   5. Serve the builds with the export's serve-dist.mjs on free ports and record startup, five
 *      clicks and the cold visits in Chromium (record-*.mjs). Live builds' /api GETs go to
 *      production (browser.mjs); --offline skips every live recording and the page says so.
 *   6. Assemble one self-contained HTML file (build.mjs) and write it to --out.
 * The scratch folder and every server this run started are removed on exit, error or Ctrl-C.
 *
 * Usage: node tools/atlas/run.mjs [--ref <ref>] [--out <file>] [--offline]
 */
import { chromium } from '@playwright/test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE_API_ORIGIN } from './browser.mjs';
import { buildAtlas } from './build.mjs';
import { indexFiles, repoFacts } from './index-files.mjs';
import { recordClicks } from './record-clicks.mjs';
import { recordStartup } from './record-startup.mjs';
import { recordWire } from './record-wire.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USAGE = 'usage: node tools/atlas/run.mjs [--ref <ref>] [--out <file>] [--offline]';
const NEVER_PORTS = new Set([8001]); // the owner's pdf-translator
/** Vite's caches stay out of the farm, so the export's builds write their own. */
const FARM_SKIP = new Set(['.vite', '.vite-temp', '.cache']);
const HEALTH_FIELDS = ['status', 'market_data', 'durable_store', 'price_cache', 'gex_kernel'];
/** Checks cheap enough to run on every generation; the page quotes their verdict and exit code. */
const CHECKS = {
  filings: { script: 'tools/research-notes/check-filings.mjs', summary: /^filings: .*$/m },
  tokens: {
    script: 'design/src/verify-tokens.mjs',
    summary: /^All shared tokens match.*$|^\d+ mismatch.*$/m,
  },
};

const started = Date.now();
const log = (msg) =>
  console.log(`[atlas ${((Date.now() - started) / 1000).toFixed(1).padStart(5)} s] ${msg}`);

function parseArgs(argv) {
  const opts = { ref: 'HEAD', out: path.join(REPO, 'docs', 'atlas', 'index.html'), offline: false };
  const fail = (msg) => {
    console.error(`[atlas] ${msg}\n${USAGE}`);
    process.exit(2);
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => {
      const v = inline ?? argv[++i];
      if (!v) fail(`${flag} needs a value`);
      return v;
    };
    if (flag === '--offline' && inline === undefined) opts.offline = true;
    else if (flag === '--ref') opts.ref = value();
    else if (flag === '--out') opts.out = path.resolve(value());
    else if (flag === '--help' || flag === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else fail(`unknown argument ${argv[i]}`);
  }
  return opts;
}

const git = (...args) =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

/** `git archive <sha> | tar -x -C <dir>`, failing if either side fails. */
function exportCommit(sha, dir) {
  return new Promise((resolve, reject) => {
    const archive = spawn('git', ['archive', '--format=tar', sha], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const tar = spawn('tar', ['-x', '-f', '-', '-C', dir], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    archive.stdout.pipe(tar.stdin);
    const codes = {};
    const done = (who) => (code) => {
      codes[who] = code;
      if ('archive' in codes && 'tar' in codes) {
        if (codes.archive === 0 && codes.tar === 0) resolve();
        else reject(new Error(`git archive exited ${codes.archive}, tar exited ${codes.tar}`));
      }
    };
    archive.on('error', reject).on('close', done('archive'));
    tar.on('error', reject).on('close', done('tar'));
  });
}

/**
 * The export's node_modules: a real folder of symlinks into this checkout's node_modules. A
 * workspace link (a symlink that resolves inside the repo but outside node_modules) is recreated
 * with the same relative target, so it lands on the export's copy of that package.
 * @returns {string[]} every link created, so clean-up removes the links, never what they point at
 */
function linkNodeModules(exportRoot) {
  const from = path.join(REPO, 'node_modules');
  const to = path.join(exportRoot, 'node_modules');
  const links = [];
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  const link = (rel) => {
    const source = path.join(from, rel);
    const target = path.join(to, rel);
    if (lstatSync(source).isSymbolicLink()) {
      const resolved = path.resolve(path.dirname(source), readlinkSync(source));
      if (resolved.startsWith(REPO + path.sep) && !resolved.startsWith(from + path.sep)) {
        symlinkSync(
          path.relative(path.dirname(target), path.join(exportRoot, path.relative(REPO, resolved))),
          target,
          type,
        );
        links.push(target);
        return;
      }
    }
    symlinkSync(source, target, type);
    links.push(target);
  };
  mkdirSync(to);
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (FARM_SKIP.has(entry.name) || !(entry.isDirectory() || entry.isSymbolicLink())) continue;
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      mkdirSync(path.join(to, entry.name));
      for (const sub of readdirSync(path.join(from, entry.name))) link(path.join(entry.name, sub));
    } else link(entry.name);
  }
  return links;
}

/** Run a build step quietly; on failure print what it said and stop. */
function step(label, command, { cwd, env }) {
  const t = Date.now();
  const r = spawnSync(command, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
    throw new Error(`${label}: \`${command}\` exited ${r.status ?? r.signal}`);
  }
  log(`${label}: ok in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  return r.stdout;
}

/** Capitalised function and class names in the forced vendor chunks (only node_modules code). */
function vendorComponentNames(assetsDir) {
  const names = new Set();
  for (const file of readdirSync(assetsDir).filter((f) => /^(mui|react|router)-.*\.js$/.test(f))) {
    const code = readFileSync(path.join(assetsDir, file), 'utf8');
    for (const m of code.matchAll(/\b(?:function|class)\s+([A-Z][\w$]*)/g)) names.add(m[1]);
  }
  return names;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, 'localhost', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(origin, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw new Error(`serve-dist for ${origin} exited ${child.exitCode}`);
    try {
      const res = await fetch(origin + '/');
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`serve-dist did not answer at ${origin}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sha = git('rev-parse', '--verify', `${opts.ref}^{commit}`);
  const date = git('show', '-s', '--format=%cs', sha);
  log(`ref ${opts.ref} → ${sha} (${date})${opts.offline ? ', offline' : ''}`);

  const scratch = mkdtempSync(path.join(os.tmpdir(), 'convexa-atlas-'));
  const servers = [];
  let links = [];
  let browser = null;
  const cleanup = () => {
    for (const s of servers) if (s.exitCode === null) s.kill();
    for (const l of links) {
      try {
        unlinkSync(l);
      } catch {
        // already gone
      }
    }
    rmSync(scratch, { recursive: true, force: true });
  };
  const onSignal = (signal) => {
    log(`${signal}: cleaning up`);
    cleanup();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    const src = path.join(scratch, 'src');
    mkdirSync(src);
    await exportCommit(sha, src);
    links = linkNodeModules(src);
    log(`exported to ${src} (${links.length} node_modules links)`);

    const app = path.join(src, 'apps', 'dashboard');
    const env = {
      NODE_ENV: 'production',
      PATH: `${path.join(src, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}`,
    };
    const modes = opts.offline ? ['demo'] : ['demo', 'live'];
    const dev = {};
    for (const mode of modes) {
      dev[mode] = path.join(scratch, `dev-${mode}`);
      step(
        `unminified ${mode} build`,
        `vite build --mode production --minify false --outDir "${dev[mode]}" --emptyOutDir --logLevel warn`,
        {
          cwd: app,
          env: { ...env, VITE_DATA_MODE: mode },
        },
      );
    }
    // The production build is the ref's own command (the Nx target), so it matches a deploy.
    const prodCommand = JSON.parse(readFileSync(path.join(app, 'package.json'), 'utf8')).nx.targets
      .build.configurations.production.command;
    const prod = {};
    let bundle = null;
    for (const mode of [...modes].reverse()) {
      step(`production ${mode} build`, prodCommand, {
        cwd: app,
        env: { ...env, VITE_DATA_MODE: mode },
      });
      if (mode === 'live' || opts.offline) {
        // The bundle chapter quotes the live build; offline, the demo build's JavaScript is the
        // same apart from the bootstrap script. The project's own budget check, in --json mode:
        // it prints the per-asset sizes and budgets, then its verdict, and exits 1 on an overrun.
        const r = spawnSync(process.execPath, ['tools/check-dashboard-bundle.mjs', '--json'], {
          cwd: src,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        });
        const docs = r.stdout
          .trim()
          .split(/\n(?=\{$)/m)
          .map((d) => JSON.parse(d));
        if (docs.length !== 2 || r.status > 1)
          throw new Error(
            `check-dashboard-bundle.mjs --json exited ${r.status}: ${r.stderr.trim()}`,
          );
        const [sizes, verdict] = docs;
        bundle = {
          mode,
          exit: r.status,
          passes: verdict.passes.length,
          failures: verdict.failures,
          assets: sizes.assets,
          budgets: sizes.budgets,
        };
        log(
          `bundle check: exit ${r.status}; ${bundle.passes} brotli checks within budget, ${bundle.failures.length} over, ${bundle.assets.length} js assets`,
        );
      }
      prod[mode] = path.join(scratch, `prod-${mode}`);
      renameSync(path.join(app, 'dist'), prod[mode]);
    }

    const checks = {};
    for (const [name, { script, summary }] of Object.entries(CHECKS)) {
      const r = spawnSync(process.execPath, [script], { cwd: src, encoding: 'utf8' });
      const out = `${r.stdout}\n${r.stderr}`;
      checks[name] = {
        exit: r.status,
        summary: (out.match(summary) || ['no summary line'])[0].trim(),
      };
      if (name === 'tokens')
        checks[name].summary =
          `${(out.match(/^✓/gm) || []).length} checks pass, ${(out.match(/^✗/gm) || []).length} fail; ${checks[name].summary}`;
      log(`${name} check: exit ${r.status}; ${checks[name].summary}`);
    }

    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', sha], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\0')
      .filter(Boolean);
    const files = indexFiles(src, paths);
    const facts = repoFacts(src, paths);
    log(
      `indexed ${files.rows.length} files one by one, ${files.bulk.reduce((a, b) => a + b.n, 0)} in summarised folders, ${Object.keys(files.comp).length} component names`,
    );

    const serve = async (dir) => {
      let port = await freePort();
      while (NEVER_PORTS.has(port)) port = await freePort();
      const child = spawn(
        process.execPath,
        [
          path.join(src, 'apps', 'dashboard-e2e', 'tools', 'serve-dist.mjs'),
          dir,
          String(port),
          'localhost',
          'http',
        ],
        {
          stdio: 'ignore',
        },
      );
      servers.push(child);
      const origin = `http://localhost:${port}`;
      await waitForServer(origin, child);
      return origin;
    };
    const devOrigins = {
      demo: await serve(dev.demo),
      live: opts.offline ? null : await serve(dev.live),
    };
    const prodOrigins = {
      demo: await serve(prod.demo),
      live: opts.offline ? null : await serve(prod.live),
    };

    browser = await chromium.launch();
    // Names the vendor chunks also give a component (MUI's Stack renders as `Grid`) are as
    // ambiguous at runtime as names imported from a package: leave them out of "ours" too.
    const vendor = vendorComponentNames(path.join(dev.demo, 'assets'));
    files.shadowed = Object.keys(files.comp).filter(
      (name) => files.shadowed.includes(name) || vendor.has(name),
    );
    const shadowed = new Set(files.shadowed);
    const ours = Object.keys(files.comp).filter((name) => !shadowed.has(name));
    log(
      `recording ${ours.length} component names; left out as ambiguous: ${files.shadowed.join(', ') || 'none'}`,
    );
    const startup = await recordStartup(browser, { ours, origins: devOrigins, log });
    const clicks = await recordClicks(browser, { ours, origins: devOrigins, log });
    const wire = await recordWire(browser, { origins: prodOrigins, dist: prod, log });
    await browser.close();
    browser = null;

    let health = null;
    if (!opts.offline) {
      const res = await fetch(`${LIVE_API_ORIGIN}/api/health`);
      if (!res.ok) throw new Error(`${LIVE_API_ORIGIN}/api/health answered ${res.status}`);
      const body = await res.json();
      health = Object.fromEntries(HEALTH_FIELDS.map((k) => [k, body[k] ?? null]));
      health.public_per_min = body.rate_limit?.public_per_min ?? null;
      log(`production health: ${JSON.stringify(health)}`);
    }

    const html = buildAtlas({
      meta: { sha, date, offline: opts.offline, liveApi: LIVE_API_ORIGIN },
      facts,
      page: { files, startup, clicks, wire, bundle, checks, health },
      fontsDir: path.join(app, 'public', 'fonts'),
    });
    mkdirSync(path.dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, html);
    const shown = path.relative(process.cwd(), opts.out);
    log(
      `wrote ${shown.startsWith('..') ? opts.out : shown} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`,
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
    cleanup();
  }
}

main().catch((error) => {
  console.error(`[atlas] failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
