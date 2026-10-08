#!/usr/bin/env node
// entry_status.mjs — the startup check: one read-only pass over a consumer root that prints a status
// card and ends with exactly one sentinel line, `startup: continue` or `startup: stop`.
//
// Usage (from the project root, through the installed tools directory):
//   node <install-root>/tools/entry_status.mjs --then open|ask [--json]
//
// What it does: checks the launcher and the install record, runs the health check through the
// launcher, compares the two version files, and reads the saved-progress and git counts. It detects
// the operating system from process.platform and infers a shell from neutral environment signals,
// or says "not detected". It changes nothing under the project root: its one temporary folder lives
// under os.tmpdir() and is removed afterwards.
//
// What it never does: list ascents, name a conductor, recommend anything, write continuity, read
// the clause's own temporary output, read a provider-specific environment variable, or print a
// command. Every child process starts through the injectable `run` seam, with an argv array and no
// shell. The shipped default of `run` is the imported process-spawning function itself.
//
// Node builtins only, plus the sibling continuity tool. The exit status is 0 exactly when the card
// ends `startup: continue`, 1 on `startup: stop`, and 2 when the check itself crashed (no sentinel).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { listContinuity, parseStatus } from './continuity.mjs';

export const SCHEMA = 'spire.entry-status.v1';

const DOCTOR_TIMEOUT_MS = 5000;
const GIT_TIMEOUT_MS = 1000;
const UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STEP_NAMES = Object.freeze(['Install', 'Health', 'Version', 'Your work', 'Ascent']);
const SHELL_NAMES = new Set(['zsh', 'bash', 'sh', 'dash', 'fish', 'ksh']);
const MACHINE_FIELD_CAP = 64;
const FREE_TEXT_CAP = 200;
const BOUNDARY_LINE = 'This check does not mean any role or gate executed.';
const OS_LABELS = Object.freeze({ darwin: 'macOS', win32: 'Windows', linux: 'Linux' });

// ---- text helpers --------------------------------------------------------------------------------

// Every code point outside 0x20-0x7E becomes one `?`; the value is then capped at 64 characters.
function ascii(value) {
  let out = '';
  for (const ch of String(value ?? '')) {
    const cp = ch.codePointAt(0);
    out += cp >= 0x20 && cp <= 0x7e ? ch : '?';
  }
  return out.slice(0, MACHINE_FIELD_CAP);
}

// Free text from a child or a file: control characters become `?`, the line is bounded.
function oneLine(text) {
  return String(text).replace(/[\u0000-\u001f\u007f]/g, '?').trim().slice(0, FREE_TEXT_CAP);
}

function firstLine(text) {
  const line = String(text ?? '').split(/\r\n|\r|\n/).find((candidate) => candidate.trim().length > 0);
  return line === undefined ? null : oneLine(line);
}

function plural(count, one, many) {
  return count === 1 ? one : many;
}

// Paths shown with `/` on win32 (a backslash path pasted into a POSIX-style shell breaks); a POSIX
// path is never rewritten, because a backslash is a legal filename byte there.
function displayPath(value, platform) {
  return platform === 'win32' ? String(value).split('\\').join('/') : String(value);
}

function baseName(value, platform) {
  return (platform === 'win32' ? path.win32 : path.posix).basename(String(value));
}

function isoDate(deadline) {
  const ms = Date.parse(deadline);
  return Number.isNaN(ms) ? String(deadline) : new Date(ms).toISOString().slice(0, 10);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ---- machine detection ---------------------------------------------------------------------------

/**
 * The operating system is authoritative (the platform of the process the host's command started).
 * The shell is an inference, never an input: absent or ambiguous signals give "not detected".
 * Pure when its inputs are injected; spawns nothing, reads no file, and reads exactly one
 * environment key: MSYSTEM on win32, SHELL elsewhere. Total: it never throws.
 */
export function detectMachine({
  platform = process.platform,
  env = process.env,
  release = os.release(),
  arch = process.arch,
} = {}) {
  const rawPlatform = String(platform ?? '');
  const label = Object.hasOwn(OS_LABELS, rawPlatform) ? OS_LABELS[rawPlatform] : (ascii(rawPlatform) || 'unknown');
  // One property get per call; an environment that throws on the read (or is not an object) is no signal.
  const read = (key) => {
    try {
      return env[key];
    } catch {
      return undefined;
    }
  };
  let shellHint = 'none';
  let shellBasis = 'none';
  if (rawPlatform === 'win32') {
    const msystem = read('MSYSTEM');
    if (typeof msystem === 'string' && msystem.length > 0) {
      shellHint = 'git-bash';
      shellBasis = 'MSYSTEM';
    }
  } else {
    const login = read('SHELL');
    if (typeof login === 'string') {
      const name = path.posix.basename(login);
      if (SHELL_NAMES.has(name)) {
        shellHint = name;
        shellBasis = 'SHELL';
      }
    }
  }
  return {
    label,
    platform: ascii(rawPlatform),
    release: ascii(release),
    arch: ascii(arch),
    shell_hint: shellHint,
    shell_basis: shellBasis,
  };
}

function shellPhrase(machine) {
  if (machine.shell_basis === 'MSYSTEM') return `shell: ${ascii(machine.shell_hint)}, inferred from MSYSTEM`;
  if (machine.shell_basis === 'SHELL') return `shell: ${ascii(machine.shell_hint)}, inferred from SHELL (the login shell)`;
  return machine.platform === 'win32'
    ? 'shell: not detected (PowerShell and cmd are not told apart)'
    : 'shell: not detected';
}

function machineLabel(machine) {
  return ascii(machine?.label) || 'unknown';
}

function machineLine(machine) {
  const m = machine ?? {};
  return `machine: ${machineLabel(m)} (${ascii(m.platform)} ${ascii(m.release)} ${ascii(m.arch)}); ${shellPhrase(m)}`;
}

// ---- the report ----------------------------------------------------------------------------------

function toMs(now) {
  const ms = now instanceof Date ? now.getTime() : typeof now === 'string' ? Date.parse(now) : now;
  if (typeof ms !== 'number' || Number.isNaN(ms)) throw new TypeError('now must be a Date, a number or an ISO date string');
  return ms;
}

function readJsonObject(readFile, file) {
  try {
    const value = JSON.parse(readFile(file));
    return plainObject(value) ? value : null;
  } catch {
    return null;
  }
}

function emptyFacts(machine) {
  return {
    project: null,
    cwd: null,
    branch: null,
    receipt: null,
    version_file: null,
    doctor: null,
    resumes: null,
    uncommitted: null,
    ahead: null,
    git_note: null,
    spawn_errors: null,
    temp_removal_error: null,
    error: null,
    machine,
  };
}

// The clause's own scratch paths and this check's declared fallback folder are never the
// operator's work. Porcelain paths use `/` on every OS.
function excludedFromDirty(file) {
  return file === '.spire/tmp/entry-doctor-in.json'
    || file.startsWith('.spire/tmp/entry-doctor/')
    || file.startsWith('.spire/tmp/entry-status/');
}

function dirtyCount(porcelain) {
  let count = 0;
  for (const line of porcelain.split(/\r?\n/)) {
    if (line.length === 0) continue;
    let file = line.slice(3);
    const arrow = file.indexOf(' -> ');
    if (arrow !== -1) file = file.slice(arrow + 4);
    if (file.startsWith('"') && file.endsWith('"')) file = file.slice(1, -1);
    if (!excludedFromDirty(file)) count += 1;
  }
  return count;
}

function resumeStatusLine(readFile, absolute) {
  let text;
  try {
    text = String(readFile(absolute));
  } catch {
    return null;
  }
  for (const line of text.split(/\r?\n/)) {
    if (parseStatus(line, 'resume') !== null) return line;
  }
  return null;
}

/**
 * Build the startup result for `root`. Pure given its inputs: `run` is the child-process seam
 * (default: the imported spawn function, unwrapped), `readFile` returns file text, `now` is a Date,
 * a millisecond number or an ISO string. Never writes under `root`.
 */
export function startupReport({
  root,
  then,
  now,
  run = spawnSync,
  readFile = (file) => fs.readFileSync(file, 'utf8'),
  machine = detectMachine(),
  timeoutMs = DOCTOR_TIMEOUT_MS,
} = {}) {
  if (then !== 'open' && then !== 'ask') throw new Error('--then must be open or ask');
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('root must be a non-empty path');
  const nowMs = toMs(now);
  const platform = machine?.platform;

  const facts = emptyFacts(machine);
  facts.project = baseName(root, platform);
  facts.cwd = displayPath(root, platform);

  const findings = [];
  const values = { Install: 'ok', Health: 'ok', Version: 'ok', 'Your work': 'ok' };
  let stoppedAt = null;
  const add = (id, step, severity, detail = '') => {
    findings.push({ id, step, severity, detail });
    // A stop ends the run, so no finding follows a stopped one in any step.
    if (severity === 'stopped') {
      stoppedAt = step;
      values[step] = 'stopped';
    } else {
      values[step] = 'heads-up';
    }
  };
  const options = (timeout) => ({ cwd: root, timeout, killSignal: 'SIGKILL', windowsHide: true, encoding: 'utf8' });
  const spawnError = (file, error) => {
    facts.spawn_errors.push({ file, code: ascii(error.code ?? 'UNKNOWN') });
  };

  // ---- Install -----------------------------------------------------------------------------------
  let doctorMayRun = false;
  if (!fs.existsSync(path.join(root, '.spire', 'bin', 'spire.mjs'))) {
    add('shim-missing', 'Install', 'stopped');
  } else {
    const receipt = readJsonObject(readFile, path.join(root, '.spire', 'installation.json'));
    if (receipt === null) {
      add('receipt-unreadable', 'Install', 'heads-up');
    } else {
      facts.receipt = {
        schema: receipt.schema ?? null,
        root: typeof receipt.root === 'string' ? receipt.root : null,
        target_version: typeof receipt.target_version === 'string' ? receipt.target_version : null,
      };
      // Coupled to the kernel's RECEIPT_SCHEMA (3): a release that bumps it updates this check.
      if (receipt.schema === 3) doctorMayRun = true;
      else add('receipt-not-v4', 'Install', 'heads-up');
    }
  }

  // ---- Health ------------------------------------------------------------------------------------
  if (stoppedAt === null && !doctorMayRun) values.Health = 'not checked';
  if (stoppedAt === null && doctorMayRun) {
    let tmp = null;
    let setupFailed = false;
    let spawned = null;
    let result = null;
    try {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spire-entry-status-'));
      fs.writeFileSync(
        path.join(tmp, 'in.json'),
        JSON.stringify({ root: platform === 'win32' ? root.split('\\').join('/') : root }),
      );
    } catch {
      setupFailed = true;
    }
    try {
      if (!setupFailed) {
        const outDir = path.join(tmp, 'out');
        facts.spawn_errors ??= []; // null until a child is spawned, [] from the first spawn on (section 2.2)
        spawned = run(
          process.execPath,
          ['.spire/bin/spire.mjs', 'doctor', '--input', path.join(tmp, 'in.json'), '--out', outDir],
          options(timeoutMs),
        );
        result = readJsonObject(readFile, path.join(outDir, 'result.json'));
      }
    } finally {
      if (tmp !== null) {
        try {
          fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
        } catch (error) {
          facts.temp_removal_error = ascii(error?.code ?? 'UNKNOWN');
        }
      }
    }

    const error = spawned?.error;
    const exit = Number.isInteger(spawned?.status) ? spawned.status : null;
    const stderr = String(spawned?.stderr ?? '');
    const checks = Array.isArray(result?.checks) ? result.checks : [];
    const failedIds = checks.filter((check) => check?.pass !== true).map((check) => (typeof check?.id === 'string' ? check.id : '?'));
    const doctor = {
      ran: false,
      exit,
      healthy: result === null ? null : result.healthy === true,
      failed_ids: failedIds,
      first_error: null,
      retention_deadline: typeof result?.retention_deadline === 'string' ? result.retention_deadline : null,
    };
    facts.doctor = doctor;
    if (setupFailed) {
      add('doctor-unstarted', 'Health', 'heads-up');
    } else if (error && error.code !== 'ETIMEDOUT') {
      spawnError('node', error);
      add('doctor-unstarted', 'Health', 'heads-up');
    } else if (error) {
      add('doctor-timeout', 'Health', 'heads-up');
    } else if (result === null && exit === 1 && /no recovery launcher installed/.test(stderr)) {
      add('no-local-install', 'Health', 'heads-up');
    } else if (result !== null && result.healthy !== true) {
      doctor.ran = true;
      add('doctor-unhealthy', 'Health', 'stopped', `${failedIds.length} of ${checks.length} health checks failed; their ids are in the footer.`);
    } else if (result !== null && exit === 0) {
      doctor.ran = true;
    } else {
      doctor.ran = true;
      doctor.first_error = firstLine(stderr);
      add('doctor-failed', 'Health', 'stopped');
    }
  }

  // ---- Version -----------------------------------------------------------------------------------
  if (stoppedAt === null) {
    try {
      const text = readFile(path.join(root, '.spire', 'version')).toString().trim();
      facts.version_file = text.length > 0 ? oneLine(text) : null;
    } catch {
      // unreadable: facts.version_file stays null
    }
    const recorded = facts.receipt?.target_version ?? null;
    if (facts.version_file !== null && recorded !== null && facts.version_file !== recorded) {
      add('version-mismatch', 'Version', 'heads-up');
    }
    if (facts.doctor?.ran === true && facts.doctor.retention_deadline !== null) {
      const deadline = Date.parse(facts.doctor.retention_deadline);
      if (!Number.isNaN(deadline) && deadline >= nowMs && deadline - nowMs <= UNDO_WINDOW_MS) {
        add('undo-window', 'Version', 'heads-up');
      }
    }
    if (findings.every((finding) => finding.step !== 'Version') && facts.version_file === null && recorded === null) {
      values.Version = 'not checked';
    }
  }

  // ---- Your work ---------------------------------------------------------------------------------
  if (stoppedAt === null) {
    const git = (args) => {
      facts.spawn_errors ??= [];
      const spawned = run('git', ['--no-optional-locks', ...args], options(GIT_TIMEOUT_MS)) ?? {};
      if (spawned.error && spawned.error.code !== 'ETIMEDOUT') {
        spawnError('git', spawned.error);
        return { spawnFailed: true, ok: false, stdout: '', stderr: '' };
      }
      return {
        spawnFailed: false,
        ok: !spawned.error && spawned.status === 0,
        stdout: String(spawned.stdout ?? ''),
        stderr: spawned.stderr,
      };
    };
    let notReadable = false;
    let noUpstream = false;
    const failed = (call) => {
      if (call.spawnFailed) return;
      if (/no upstream/i.test(call.stderr)) noUpstream = true;
      else notReadable = true;
    };

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch.ok && firstLine(branch.stdout) !== null) facts.branch = firstLine(branch.stdout);
    else failed(branch);

    const ahead = git(['rev-list', '--count', '@{upstream}..HEAD']);
    const count = ahead.stdout.trim();
    if (ahead.ok && /^\d+$/.test(count)) facts.ahead = Number(count);
    else failed(ahead);

    const status = git(['status', '--porcelain', '--untracked-files=all']);
    if (status.ok) facts.uncommitted = dirtyCount(status.stdout);
    else failed(status);

    if (notReadable) facts.git_note = 'not readable';
    else if (noUpstream) facts.git_note = 'no upstream';
    if (facts.ahead !== null && facts.ahead > 0) add('unpushed', 'Your work', 'heads-up');

    facts.resumes = listContinuity(root)
      .filter((item) => item.kind === 'resume' && item.status === 'ACTIVE')
      .map((item) => ({ path: displayPath(item.path, platform), status_line: resumeStatusLine(readFile, item.absolute) }));
  }

  // ---- the result --------------------------------------------------------------------------------
  const stopped = stoppedAt !== null;
  const steps = [];
  let reached = true;
  for (const step of STEP_NAMES) {
    if (step === 'Ascent') {
      steps.push({ step, value: stopped ? 'not reached' : 'next' });
    } else {
      steps.push({ step, value: reached ? values[step] : 'not reached' });
      if (step === stoppedAt) reached = false;
    }
  }
  const result = {
    schema: SCHEMA,
    state: stopped ? 'stop' : 'continue',
    then,
    timeout_s: timeoutMs / 1000,
    steps,
    findings,
    facts,
  };
  for (const finding of findings) {
    if (finding.detail === '') finding.detail = findingText(finding, result);
  }
  return result;
}

// ---- the card ------------------------------------------------------------------------------------

const STOPPED_TEXT = Object.freeze({
  'shim-missing': {
    broke: 'the launcher file .spire/bin/spire.mjs is missing.',
    remedy: 'reinstall this root from a clean release tag',
  },
  'doctor-failed': {
    broke: 'the health check did not finish; its first error line is in the footer.',
    remedy: 'read the health-check error in the footer, then repair or reinstall',
  },
  'doctor-unhealthy': {
    broke: null,
    remedy: 'repair the failed health checks, or reinstall from a clean release tag',
  },
});

const NEXT_CONTINUE = Object.freeze({
  open: 'nothing needed from you; the entry reads its conductor only if its own startup steps also passed.',
  ask: 'choose the ascent when the entry asks; it asks only if its own startup steps also passed.',
});

// The sentence a finding shows: the heads-up row text (without its prefix) or the stopped card's
// Broke text. Built from the result's facts, so a planted result renders without a stored detail.
function findingText(finding, result) {
  const facts = result.facts ?? {};
  const receipt = facts.receipt ?? {};
  const recordedRoot = typeof receipt.root === 'string' ? oneLine(receipt.root) : 'not recorded';
  const folder = facts.cwd ?? 'unknown';
  switch (finding.id) {
    case 'shim-missing':
    case 'doctor-failed':
      return STOPPED_TEXT[finding.id].broke;
    case 'doctor-unhealthy': {
      const failed = Array.isArray(facts.doctor?.failed_ids) ? facts.doctor.failed_ids.length : 0;
      return `${failed} of ? health checks failed; their ids are in the footer.`;
    }
    case 'receipt-unreadable':
      return 'Install record not readable here; health not checked.';
    case 'receipt-not-v4':
      return 'Install record is not a v4 record; health not checked.';
    case 'no-local-install':
      return `Health not checked on this machine: no local install. Recorded by the install: root ${recordedRoot}; this folder: ${folder}.`;
    case 'doctor-unstarted':
      return `Health not checked: the health check could not be started here. Recorded by the install: root ${recordedRoot}; this folder: ${folder}.`;
    case 'doctor-timeout':
      return `Health not checked: the health check took over ${result.timeout_s} s. Recorded by the install: root ${recordedRoot}; this folder: ${folder}.`;
    case 'version-mismatch':
      return `Version files disagree: .spire/version says ${facts.version_file}; the install record says ${receipt.target_version}.`;
    case 'undo-window':
      return `The undo copy recorded by the install expires ${isoDate(facts.doctor?.retention_deadline)}.`;
    case 'unpushed':
      return `${facts.ahead} local ${plural(facts.ahead, 'commit', 'commits')} not on the upstream of ${facts.branch ?? 'HEAD'}.`;
    default:
      return `${finding.id}.`;
  }
}

function footerFacts(facts) {
  const lines = [];
  const doctor = facts.doctor;
  if (doctor && Array.isArray(doctor.failed_ids) && doctor.failed_ids.length > 0) {
    lines.push(`doctor failed checks: ${doctor.failed_ids.join(', ')}`);
  }
  if (doctor && typeof doctor.first_error === 'string') lines.push(`doctor error: ${doctor.first_error}`);
  const seen = new Set();
  for (const entry of facts.spawn_errors ?? []) {
    const line = `spawn error: ${entry.file} ${entry.code}`;
    if (!seen.has(line)) lines.push(line);
    seen.add(line);
  }
  const resumes = facts.resumes ?? [];
  for (const resume of resumes.slice(0, 3)) {
    lines.push(`saved progress: ${resume.path} (${typeof resume.status_line === 'string' ? resume.status_line : 'no status line'})`);
  }
  if (resumes.length > 3) lines.push(`saved progress: +${resumes.length - 3} more`);
  if (typeof facts.uncommitted === 'number' && facts.uncommitted > 0) lines.push(`uncommitted: ${facts.uncommitted} paths`);
  if (facts.git_note) lines.push(`git: ${facts.git_note}`);
  if (facts.temp_removal_error) lines.push(`temp folder not removed: ${facts.temp_removal_error}`);
  return lines;
}

/** Render the card text for a result. Reads only the result's own fields; never touches the process. */
export function renderCard(result) {
  const facts = result.facts ?? {};
  const machine = facts.machine;
  const label = machineLabel(machine);
  const findings = result.findings ?? [];
  const project = facts.project || 'this folder';
  const resultLine = (state) => `result: ${state}${state === 'crashed' ? '' : findings
    .filter((finding) => finding.severity === 'stopped' || finding.severity === 'heads-up')
    .map((finding) => ` ${finding.id}:${finding.severity}`)
    .join('')}`;
  const fold = (state, rest) => [
    '---',
    '**Technical detail** *(skip freely)*',
    resultLine(state),
    machineLine(machine),
    ...rest,
    BOUNDARY_LINE,
  ];

  if (result.state === 'crashed') {
    const lines = [
      '## 🟠 PROBLEM — the startup check itself failed',
      `**${project}** · startup check failed on ${label}`,
      '',
      '**Broke:** the startup check failed.',
      '**Impact:** nothing was checked; the entry follows its own steps.',
      '**Handling:** the error is in the footer.',
      '',
      '➡️ **Next:** nothing now; report the footer error if it repeats.',
      '',
      ...fold('crashed', [`error: ${facts.error ?? 'unknown'}`]),
    ];
    return `${lines.join('\n')}\n`;
  }

  const steps = Array.isArray(result.steps) && result.steps.length === STEP_NAMES.length
    ? result.steps
    : STEP_NAMES.map((step) => ({ step, value: 'not checked' }));
  const strip = steps.map((entry) => `${entry.step} ${entry.value}`).join(' · ');
  const stoppedIndex = steps.findIndex((entry) => entry.value === 'stopped');
  const progress = result.state === 'stop' ? (stoppedIndex === -1 ? 1 : stoppedIndex + 1) : 5;
  // The branch slot (section 2.5): a stop ends the check before the Your-work step that holds its git reads, so a stop
  // card says `branch not read`; a continue card says its branch, or `no git` when that read gave none.
  const branchSlot = result.state === 'stop' ? 'branch not read' : (facts.branch ?? 'no git');
  const header = `**${project} · ${branchSlot}** · startup step ${progress} of 5 on ${label}`;
  const footer = footerFacts(facts);

  if (result.state === 'stop') {
    const stoppedFinding = findings.find((finding) => finding.severity === 'stopped') ?? { id: 'unknown', step: 'Install' };
    const known = STOPPED_TEXT[stoppedFinding.id] ?? { broke: null, remedy: 'read the footer' };
    const broke = typeof stoppedFinding.detail === 'string' && stoppedFinding.detail !== ''
      ? stoppedFinding.detail
      : findingText(stoppedFinding, result);
    const lines = [
      '## 🟠 PROBLEM — startup stopped before any conductor',
      header,
      '',
      strip,
      `**Broke:** ${broke}`,
      '**Impact:** no conductor was read; nothing was changed.',
      `**Handling:** startup stopped at ${stoppedFinding.step}; the fix needs your go.`,
      '',
      `➡️ **Next:** ${known.remedy}; that needs your go, and this check changed nothing.`,
      '',
      ...fold('stop', footer),
      'startup: stop',
    ];
    return `${lines.join('\n')}\n`;
  }

  if (result.state !== 'continue') throw new TypeError(`unknown startup state: ${String(result.state)}`);

  const headsUps = findings.filter((finding) => finding.severity === 'heads-up');
  const chip = headsUps.length === 0
    ? '## 🟢 DONE — startup checks passed'
    : `## 🟢 DONE — startup checked, ${headsUps.length} ${plural(headsUps.length, 'heads-up', 'heads-ups')}`;
  const recordedVersion = facts.receipt?.target_version ?? facts.version_file ?? 'not readable';
  const doctorRan = facts.doctor?.ran === true;
  const marked = (facts.resumes ?? []).filter(
    (resume) => typeof resume.status_line === 'string' && parseStatus(resume.status_line, 'resume') === 'ACTIVE',
  ).length;
  const body = [
    `Version: ${recordedVersion}, recorded by the install${doctorRan ? '' : '; it may describe another machine'}`,
    `Your work: ${marked} saved-progress ${plural(marked, 'file', 'files')} marked ACTIVE`,
    ...headsUps.slice(0, 3).map((finding) => `⚠️ ${typeof finding.detail === 'string' && finding.detail !== '' ? finding.detail : findingText(finding, result)}`),
  ];
  if (headsUps.length > 3) body.push(`+${headsUps.length - 3} more heads-ups, listed in the footer`);
  const lines = [
    chip,
    header,
    '',
    strip,
    ...body,
    '',
    `➡️ **Next:** ${NEXT_CONTINUE[result.then] ?? NEXT_CONTINUE.open}`,
    '',
    ...fold('continue', footer),
    'startup: continue',
  ];
  return `${lines.join('\n')}\n`;
}

// ---- the command line ----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { then: undefined, json: false };
  let valueAt; // the index of the token a --then took as its value: never read as a flag itself
  argv.forEach((token, index) => {
    if (index === valueAt) return;
    if (token === '--json') args.json = true;
    else if (token === '--then') {
      args.then = argv[index + 1];
      valueAt = index + 1;
    }
  });
  return args;
}

function crashedResult({ then, error, machine, root }) {
  const platform = machine.platform; // main always hands over a detected machine
  const facts = emptyFacts(machine);
  if (typeof root === 'string' && root.length > 0) {
    facts.project = baseName(root, platform);
    facts.cwd = displayPath(root, platform);
  }
  facts.error = firstLine(error?.message ?? error) ?? 'unknown error';
  return {
    schema: SCHEMA,
    state: 'crashed',
    then: then === 'open' || then === 'ask' ? then : null,
    timeout_s: DOCTOR_TIMEOUT_MS / 1000,
    steps: STEP_NAMES.map((step) => ({ step, value: 'not checked' })),
    findings: [],
    facts,
  };
}

/**
 * The command. Computes the machine first (it never throws), builds the report, writes the card to
 * stdout with explicit LF, and sets the exit status through `setExitCode` (default: process.exitCode;
 * the process is never ended from here, so the sentinel line is always flushed). A crash prints the
 * crashed card with no sentinel. Returns the exit status.
 */
export function main(argv = process.argv.slice(2), deps = {}) {
  const machine = deps.machine ?? detectMachine();
  const args = parseArgs(argv);
  let root = null;
  let result;
  let text;
  const render = (value) => (args.json ? `${JSON.stringify(value, null, 2)}\n` : renderCard(value));
  try {
    root = deps.root ?? process.cwd();
    result = startupReport({
      root,
      then: args.then,
      now: deps.now ?? new Date(),
      run: deps.run,
      readFile: deps.readFile,
      machine,
      timeoutMs: deps.timeoutMs,
    });
    text = render(result);
  } catch (error) {
    result = crashedResult({ then: args.then, error, machine, root });
    text = render(result);
  }
  (deps.stdout ?? process.stdout).write(text);
  const code = result.state === 'continue' ? 0 : result.state === 'stop' ? 1 : 2;
  if (deps.setExitCode) deps.setExitCode(code);
  else process.exitCode = code;
  return code;
}

// The project root is process.cwd(), never derived from this module's URL (which resolves a
// junction to its target). The main guard compares realpaths of argv[1] and this file.
export function invokedAsScript() {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedAsScript()) main();
