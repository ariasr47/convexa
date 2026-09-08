#!/usr/bin/env node
/**
 * visual_receipts.mjs — DRAFTS the two HUMAN receipts of the visual-baseline flow from evidence on
 * disk, then runs the repository's own validators on what it drafted. It is a hashing aid for the
 * person (or the conductor acting on the owner's explicit instruction) who has ALREADY inspected the
 * images; it never runs the update command, never touches `snapshots/`, and prints what to look at
 * before each decision. Policy: `apps/dashboard-e2e/visual-review/README.md` (owner/design reviewer
 * authors the authorization, code reviewer authors the acceptance; the update command creates
 * neither). Runs on any host with Node + git; the RECEIPTS are only valid for `win32` or `linux`.
 *
 *   node visual_receipts.mjs authorize --summary <visual summary.json> --id <authorization_id>
 *        [--actor workspace-owner] [--role owner|design_reviewer] [--revision <40hex>] [--force]
 *   node visual_receipts.mjs accept --candidate-set <candidate-sets/<id>.json>
 *        [--actor workspace-code-reviewer] [--reject] [--id <acceptance_id>] [--force]
 *   node visual_receipts.mjs check (--authorization|--candidate-set|--acceptance) <path>
 *   node visual_receipts.mjs stability --acceptance <path> --summary <run1 summary> --summary <run2 summary>
 *
 * Paths are repository-relative POSIX or absolute. `authorize` copies the failed compare's evidence
 * (summary + actual/expected/diff PNGs) into `visual-review/evidence/<id>/` first, exactly as the
 * 2026-08-24 win32 flow retained its evidence, because every receipt path must exist in the
 * repository at validation time.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = (() => {
  let dir = HERE;
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git')) && fs.existsSync(path.join(dir, 'package.json')))
      return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('repository root not found above ' + HERE);
    dir = parent;
  }
})();
const lib = await import(
  pathToFileURL(path.join(ROOT, 'apps/dashboard-e2e/tools/lib/visual-review.mjs')).href
);
const { loadManifest } = await import(
  pathToFileURL(path.join(ROOT, 'apps/dashboard-e2e/tools/lib/manifest.mjs')).href
);
const REVIEW = 'apps/dashboard-e2e/visual-review';
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const rel = (p) => path.relative(ROOT, abs(p)).split(path.sep).join('/');
const nowIso = () => new Date().toISOString();
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const writeJson = (file, value, force) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !force) throw new Error(`refusing to overwrite ${rel(file)} (use --force)`);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      if (Array.isArray(out[key])) out[key].push(next);
      else if (out[key] !== undefined) out[key] = [out[key], next];
      else out[key] = next;
      i += 1;
    }
  }
  return out;
}

function authorize(a) {
  if (!a.summary || !a.id) throw new Error('authorize needs --summary and --id');
  const summaryFile = abs(a.summary);
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  if (summary.gate !== 'visual') throw new Error('summary is not a visual gate summary');
  if (summary.status === 'pass') throw new Error('this compare passed — nothing to authorize');
  const platform = a.platform ?? summary.host_platform;
  const revision = a.revision ?? git(['rev-parse', 'HEAD']).trim();
  const manifest = loadManifest();
  const evidenceDir = path.join(ROOT, REVIEW, 'evidence', a.id);
  if (fs.existsSync(evidenceDir) && !a.force)
    throw new Error(`evidence folder already exists: ${rel(evidenceDir)} (use --force)`);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const summaryCopy = path.join(evidenceDir, 'summary.json');
  fs.copyFileSync(summaryFile, summaryCopy);
  const scenarios = manifest.visual.scenarios.map((scenario) => {
    const record = summary.scenarios.find((r) => r.scenario_id === scenario.id);
    if (!record) throw new Error(`summary has no record for ${scenario.id}`);
    // The actual image: Playwright attaches `*-actual.png` on a pixel mismatch (the reporter
    // records it as actual_path); on a MISSING baseline the only image is the failure screenshot
    // `test-failed-1.png` (what the 2026-08-24 stable-six authorization used); a PASSED scenario
    // has no actual attachment at all, so its actual is the baseline itself (identical bytes —
    // what the 2026-08-24 ai-analysis authorization recorded).
    const failedShot = (record.artifact_paths ?? []).find((p) => p.endsWith('test-failed-1.png'));
    const actualSource =
      record.actual_path ??
      (record.status === 'passed' ? record.expected_path : failedShot) ??
      null;
    if (!actualSource)
      throw new Error(`${scenario.id}: no actual image (status ${record.status}) — a readiness or fixture failure, not a pixel failure; fix that first`);
    const copy = (source, suffix) => {
      if (!source) return null;
      const target = path.join(evidenceDir, `${scenario.id}${suffix}.png`);
      fs.copyFileSync(abs(source), target);
      return rel(target);
    };
    const actual = copy(actualSource, '');
    const expected = copy(record.expected_path, '-expected');
    const diff = copy(record.diff_path, '-diff');
    return {
      scenario_id: scenario.id,
      expected_path: expected,
      expected_sha256: expected ? sha256(abs(expected)) : null,
      actual_path: actual,
      actual_sha256: sha256(abs(actual)),
      diff_path: diff,
      diff_sha256: diff ? sha256(abs(diff)) : null,
    };
  });
  const receipt = {
    schema_version: 1,
    authorization_id: a.id,
    decision: 'authorize_candidate_generation',
    state: 'authorized',
    actor: { id: a.actor ?? 'workspace-owner', role: a.role ?? 'owner' },
    source_revision: revision,
    platform,
    created_at: nowIso(),
    failed_compare: {
      run_id: summary.run_id,
      summary_path: rel(summaryCopy),
      summary_sha256: sha256(summaryCopy),
    },
    scenarios,
  };
  const file = path.join(ROOT, REVIEW, 'authorizations', `${a.id}.json`);
  writeJson(file, receipt, a.force);
  lib.validateAuthorization(receipt, manifest, Date.now(), ROOT);
  console.log(`[authorization-drafted] ${rel(file)} — VALID for ${platform} @ ${revision.slice(0, 10)}`);
  console.log(`  evidence: ${rel(evidenceDir)}/ — inspect every <scenario>.png against the design BEFORE the next step.`);
  console.log(`  next: npm run browser:visual:update -- --authorization ${rel(file)}`);
  console.log('  keep the receipt and the evidence UNTRACKED until stability is proven (the update command');
  console.log('  rejects any tracked change since source_revision other than the receipt itself).');
}

function accept(a) {
  const csPath = a['candidate-set'];
  if (!csPath) throw new Error('accept needs --candidate-set');
  const manifest = loadManifest();
  const cs = JSON.parse(fs.readFileSync(abs(csPath), 'utf8'));
  lib.validateCandidateSet(cs, manifest, ROOT);
  const authPath = `${REVIEW}/authorizations/${cs.authorization_id}.json`;
  if (!fs.existsSync(abs(authPath))) throw new Error(`authorization missing: ${authPath}`);
  const paths = cs.candidates.map((c) => c.path);
  for (const c of cs.candidates)
    if (sha256(abs(c.path)) !== c.sha256)
      throw new Error(`${c.path} no longer matches the candidate receipt — regenerate, do not accept`);
  // The source diff the reviewer signs: a binary patch of the six candidate PNGs against HEAD.
  // Never-before-tracked baselines need intent-to-add so `git diff` can see them.
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...paths])
    .split(/\r?\n/)
    .filter(Boolean);
  if (untracked.length) git(['add', '--intent-to-add', '--', ...untracked]);
  const patch = execFileSync('git', ['diff', '--binary', '--', ...paths], { cwd: ROOT });
  if (!patch.length) console.warn('  WARNING: the candidates are byte-identical to HEAD — nothing to accept?');
  const patchFile = path.join(ROOT, REVIEW, 'diffs', `${cs.candidate_set_id}.patch`);
  fs.mkdirSync(path.dirname(patchFile), { recursive: true });
  if (fs.existsSync(patchFile) && !a.force) throw new Error(`refusing to overwrite ${rel(patchFile)} (use --force)`);
  fs.writeFileSync(patchFile, patch);
  const reject = Boolean(a.reject);
  const day = nowIso().slice(0, 10).replaceAll('-', '');
  const receipt = {
    schema_version: 1,
    acceptance_id: a.id ?? `${reject ? 'reject' : 'accept'}-${cs.candidate_set_id}-${day}`,
    candidate_set_id: cs.candidate_set_id,
    decision: reject ? 'reject_candidates' : 'accept_candidates',
    state: reject ? 'rejected' : 'accepted',
    actor: { id: a.actor ?? 'workspace-code-reviewer', role: 'code_reviewer' },
    source_revision: cs.source_revision,
    platform: cs.platform,
    reviewed_at: nowIso(),
    authorization_path: authPath,
    authorization_sha256: sha256(abs(authPath)),
    candidate_receipt_path: rel(abs(csPath)),
    candidate_receipt_sha256: sha256(abs(csPath)),
    source_diff_path: rel(patchFile),
    source_diff_sha256: sha256(patchFile),
    candidates: cs.candidates.map((c) => ({ scenario_id: c.scenario_id, path: c.path, sha256: c.sha256 })),
  };
  const file = path.join(ROOT, REVIEW, 'acceptances', `${cs.candidate_set_id}.json`);
  writeJson(file, receipt, a.force);
  lib.validateAcceptance(receipt, manifest, ROOT);
  console.log(`[acceptance-drafted] ${rel(file)} — ${receipt.state.toUpperCase()}, VALID (${receipt.acceptance_id})`);
  console.log(`  patch: ${rel(patchFile)} — the reviewer signs THIS diff and the six PNGs it names.`);
  if (!reject) {
    console.log('  next: two DISTINCT compare-only runs with retries 0 at this revision/platform:');
    console.log('        npm run browser:visual   (twice; copy each visual/summary.json aside between runs)');
    console.log('        then: node visual_receipts.mjs stability --acceptance <this file> --summary <run1> --summary <run2>');
  }
}

function check(a) {
  const manifest = loadManifest();
  if (a.authorization) {
    lib.validateAuthorization(JSON.parse(fs.readFileSync(abs(a.authorization), 'utf8')), manifest, Date.now(), ROOT);
    console.log(`[authorization-valid] ${rel(abs(a.authorization))}`);
  } else if (a['candidate-set']) {
    lib.validateCandidateSet(JSON.parse(fs.readFileSync(abs(a['candidate-set']), 'utf8')), manifest, ROOT);
    console.log(`[candidate-set-valid] ${rel(abs(a['candidate-set']))}`);
  } else if (a.acceptance) {
    lib.validateAcceptance(JSON.parse(fs.readFileSync(abs(a.acceptance), 'utf8')), manifest, ROOT);
    console.log(`[acceptance-valid] ${rel(abs(a.acceptance))}`);
  } else throw new Error('check needs --authorization, --candidate-set or --acceptance');
}

function stability(a) {
  const summaries = [].concat(a.summary ?? []);
  if (!a.acceptance || summaries.length !== 2) throw new Error('stability needs --acceptance and exactly two --summary');
  const acceptance = JSON.parse(fs.readFileSync(abs(a.acceptance), 'utf8'));
  const result = lib.validateStability(acceptance, summaries.map((s) => JSON.parse(fs.readFileSync(abs(s), 'utf8'))));
  console.log(`[${result}] ${rel(abs(a.acceptance))} — two distinct clean compare runs at ${acceptance.source_revision.slice(0, 10)}/${acceptance.platform}`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  if (command === 'authorize') authorize(args);
  else if (command === 'accept') accept(args);
  else if (command === 'check') check(args);
  else if (command === 'stability') stability(args);
  else {
    console.error('usage: visual_receipts.mjs authorize|accept|check|stability … (see the header comment)');
    process.exit(2);
  }
} catch (error) {
  console.error(`[receipt-error] ${error.message}`);
  process.exit(1);
}
