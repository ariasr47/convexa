#!/usr/bin/env node
// outbound.mjs — the delivery-step tool (close-sweep T3, roadmap item 18): the ONLY code path that
// may push a ref or re-run CI for a shipped close or a GATE-S ship. Every outward act (`--push`,
// `--rerun`) refuses unless an on-disk record holds the owner's verbatim, trimmed, exact "A"/"a"
// answer to a question this tool itself generated from the seam — recorded and committed BEFORE the
// act (`CHANGE_SPEC.md` §2). Everything else (CI, revision, health, smoke) is a bounded READ.
//
// Usage:
//   node outbound.mjs --ask push --remote <r> --ref <b> --tip <sha40> [--root <path>]
//   node outbound.mjs --ask rerun --run <id> [--root <path>]
//   node outbound.mjs --record --ask push --remote <r> --ref <b> --tip <sha40> --hash <h> --answer "<verbatim>" [--root <path>]
//   node outbound.mjs --record --ask rerun --run <id> --hash <h> --answer "<verbatim>" [--root <path>]
//   node outbound.mjs --push [--root <path>]
//   node outbound.mjs --rerun [--root <path>]
//   node outbound.mjs --read [--record-path <path>] [--root <path>]
//   node outbound.mjs --observe --remote <r> --ref <b> --sha <sha40> [--root <path>]
//
// Node builtins only. `git` and `gh` run through injected `runGit`/`runGh` (default: a thin
// `spawnSync` wrapper, never a shell). Every call is bounded to MAX_CALL_MS. The smoke command is the
// ONE place spawnSync's shell mode is enabled, because the seam hands it a whole command line
// (`interface_conformance.mjs:481` precedent). No fetch, no history rewrite, no bulk or force push —
// see SOURCE_SCAN_BANS.
//
// Exit codes: 0 pass, 1 fail, 2 refusal, 3 pending, 4 unproven.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projectConfig } from './_project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MAX_CALL_MS = 540_000; // <= 540 s, under the 600 s shell cap (CHANGE_SPEC.md §2).
const OUTBOUND_REL = ['.spire', 'clusters', 'tech', 'outbound'];
const FAIL_CONCLUSIONS = Object.freeze(['failure', 'timed_out', 'startup_failure', 'action_required']);

function lf(text) {
  return String(text).replace(/\r\n/g, '\n');
}

// ---- P1: the source scan — this tool's own copy, pinned by the TEST file's own list -------------
//
// Bans (C5): each stored as the QUOTED argv literal it would appear as in source (the flanking
// apostrophes are the token, exactly as closure.mjs already does). This comment deliberately never
// spells a banned token in its own apostrophe-quoted form (it uses backticks instead), because
// `.includes()` is a pure substring search: writing the apostrophe-quoted form ANYWHERE outside the
// three scan-exempt lines below — even in prose — would trip the self-scan below. The design is
// deliberate: `--no-follow-tags` (our one required push flag) does NOT contain the apostrophe-quoted
// form of `--follow-tags`, because the quote that would need to sit right before "follow" instead sits
// before "no". The one bare (unquoted) banned token is an env-var name, never an argv literal (see the
// array below for its spelling — repeating it here would trip the very guard it defines).
//
// F5 (repair round 1): the exemption is by EXACT DECLARATION-LINE PREFIX, never a marker COMMENT a
// malicious line could simply copy onto itself (the pre-GATE-V audit's P-d3 finding: appending
// `// scan-exempt: ...` after a banned token used to hide it). `export const SOURCE_SCAN_BANS = ` and
// `export const SOURCE_SCAN_SINGLETONS = ` are each a `const`/`export const` BINDING — JavaScript
// itself refuses to parse a SECOND declaration of the same identifier in this module scope, so at most
// one line can ever start with each exact prefix. That is what makes "one line, matched by exact
// content" (closure.mjs:776's form) hold mechanically. `checkPushDestination`'s read-only
// `remote get-url --push --all` needs the literal `--all` flag, which collides with the BULK-push/
// fetch `--all` this list bans — N2_ALL_ALLOWANCE below is its own narrowly-pinned, exactly-counted
// third exemption (never a blanket comment marker).
// The exempted lines must stay ONE line each (a wrapped multi-line array would leave every literal on
// the earlier, unexempted lines) — closure.mjs:777 already does this.
// prettier-ignore
export const SOURCE_SCAN_BANS = Object.freeze(["'--force'", "'--force-with-lease'", "'--force-if-includes'", "'-f'", "'--no-verify'", "'core.hooksPath'", "'-c'", "'--mirror'", "'--all'", "'--delete'", "'-d'", "'-D'", "'--prune'", "'--tags'", "'--follow-tags'", "'fetch'", "'reset'", "'rebase'", "'--amend'", "'filter-branch'", "'update-ref'", "'revert'", "'set-url'", "'merge'", "'release'", "'api'", "'cancel'", "'delete'", "'workflow'", "'clean'", "'--clean'", 'SPIRE_OS_REGISTRY']);
export const SOURCE_SCAN_SINGLETONS = Object.freeze(["'push'", "'rerun'", "'ls-remote'", 'shell: true']);
// N2: `remote get-url --push --all` is a READ (proving there is exactly one effective push URL),
// never a bulk `push --all`/`fetch --all` WRITE — it collides with the --all ban by TEXT only. This
// exact array-literal substring (matched byte for byte against checkPushDestination's own call) is the
// ONE place the --all flag may appear, and it must appear EXACTLY ONCE in the whole file: zero means
// the real call drifted or was removed (a bare occurrence elsewhere is still banned); more than one
// means a second, illegitimate site was added.
const N2_ALL_ALLOWANCE = "['remote', 'get-url', '--push', '--all', remote]";
// The ONE SOURCE_SCAN_BANS entry N2_ALL_ALLOWANCE is permitted to contain — its own declaration line,
// so the comparison below never has to re-spell the apostrophe-quoted form a second time.
const N2_ALL_TOKEN = "'--all'";

const SCAN_EXEMPT_BANS_PREFIX = 'export const SOURCE_SCAN_BANS = ';
const SCAN_EXEMPT_SINGLETONS_PREFIX = 'export const SOURCE_SCAN_SINGLETONS = ';
const SCAN_EXEMPT_N2_ALLOWANCE_PREFIX = 'const N2_ALL_ALLOWANCE = ';
const SCAN_EXEMPT_N2_TOKEN_PREFIX = 'const N2_ALL_TOKEN = ';

function filterScanExemptLines(text) {
  const prefixes = [SCAN_EXEMPT_BANS_PREFIX, SCAN_EXEMPT_SINGLETONS_PREFIX, SCAN_EXEMPT_N2_ALLOWANCE_PREFIX, SCAN_EXEMPT_N2_TOKEN_PREFIX];
  return lf(text).split('\n').filter((line) => !prefixes.some((p) => line.startsWith(p))).join('\n');
}

/**
 * The general-purpose scan: fragment-safe (usable on an isolated fixture, not only the whole file).
 * The --all flag is allowed ONLY inside the exact `N2_ALL_ALLOWANCE` substring — no cardinality check
 * here (that is a whole-file-only invariant; see `selfScanFindings`).
 * @param {string} text @returns {string[]} findings; [] ⇒ clean
 */
export function sourceScanFindings(text) {
  const scanned = filterScanExemptLines(text);
  const findings = [];
  for (const token of SOURCE_SCAN_BANS) {
    if (token === N2_ALL_TOKEN) {
      const withoutAllowance = scanned.split(N2_ALL_ALLOWANCE).join('');
      if (withoutAllowance.includes(token)) findings.push(`banned literal present: ${token}`);
      continue;
    }
    if (scanned.includes(token)) findings.push(`banned literal present: ${token}`);
  }
  for (const token of SOURCE_SCAN_SINGLETONS) {
    const count = scanned.split(token).length - 1;
    if (count > 1) findings.push(`${token} appears ${count} times — only its one legitimate use is ever allowed`);
  }
  return findings;
}

// The two verbs and the one CLI subcommand-value each get ONE quoted-literal definition (their own
// singleton use); every other use below is a bare identifier reference. F5: those bare-identifier argv
// construction sites — a verb identifier opening or continuing an array literal — are invisible to
// sourceScanFindings' literal-token scan; verbSiteCounts below counts them separately, over the WHOLE
// file only. (This comment deliberately never writes out that bracket-adjacent shape itself, the same
// way the bans list above is never spelled twice — it would count as one more site.)
const VERB_PUSH = 'push';
const VERB_RERUN = 'rerun';
const VERB_LS_REMOTE = 'ls-remote';

const EXPECTED_VERB_SITES = Object.freeze({ push: 1, rerun: 1, lsRemote: 4 });

/**
 * F5: counts each verb used as a bare ARRAY ELEMENT (an argv-construction site) — never a comparison
 * (equality against the identifier), a field value, or a template interpolation, none of which push or
 * re-run anything.
 */
export function verbSiteCounts(text) {
  const scanned = filterScanExemptLines(text);
  const count = (verb) => (scanned.match(new RegExp(`(?:\\[|,\\s*)${verb}(?:,|\\])`, 'g')) || []).length;
  return { push: count('VERB_PUSH'), rerun: count('VERB_RERUN'), lsRemote: count('VERB_LS_REMOTE') };
}

/**
 * F5: the WHOLE-FILE-ONLY invariants layered over sourceScanFindings — meaningless on an isolated
 * fragment (there is nothing to compare a fragment's site count against), so this is the self-scan
 * used ONLY against this file's own source, never the per-token fixture checks.
 */
export function selfScanFindings(text) {
  const findings = sourceScanFindings(text);
  const scanned = filterScanExemptLines(text);
  const n2Count = scanned.split(N2_ALL_ALLOWANCE).length - 1;
  if (n2Count !== 1) findings.push(`N2's one allowed --all call must appear exactly once in the whole file (found ${n2Count})`);
  const sites = verbSiteCounts(text);
  if (sites.push !== EXPECTED_VERB_SITES.push) findings.push(`VERB_PUSH argv site count is ${sites.push}, expected exactly ${EXPECTED_VERB_SITES.push}`);
  if (sites.rerun !== EXPECTED_VERB_SITES.rerun) findings.push(`VERB_RERUN argv site count is ${sites.rerun}, expected exactly ${EXPECTED_VERB_SITES.rerun}`);
  if (sites.lsRemote !== EXPECTED_VERB_SITES.lsRemote) findings.push(`VERB_LS_REMOTE argv site count is ${sites.lsRemote}, expected exactly ${EXPECTED_VERB_SITES.lsRemote}`);
  return findings;
}

// ---- validation (exit 2 before any call) ----------------------------------------------------------

export function validateSha40Format(s) {
  return typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
}

/** F1 (repair round 1, critical): a line break in --answer can inject fake Key: value header lines
 * once the raw answer is embedded into the record header — refuse before any write, never truncate. */
export function containsLineBreak(s) {
  return /[\r\n\u2028\u2029]/.test(s);
}

export function shaIsLocal(root, sha, runGit) {
  const r = runGit(['cat-file', '-e', `${sha}^{commit}`], { cwd: root });
  return r.status === 0;
}

export function validateRefName(ref) {
  if (typeof ref !== 'string' || ref === '') return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(ref)) return false;
  if (/^[-+:]/.test(ref)) return false;
  return true;
}

export function validateRemoteNameFormat(remote) {
  if (typeof remote !== 'string' || remote === '') return false;
  if (!/^[A-Za-z0-9._-]+$/.test(remote)) return false;
  if (remote.startsWith('-')) return false;
  return true;
}

/** §2 line 24's base remote check: format, leading dash, and a configured fetch url. */
export function validateRemoteBasic(root, remote, runGit) {
  if (!validateRemoteNameFormat(remote)) return { ok: false, reason: `invalid remote name: ${remote}` };
  const r = runGit(['remote', 'get-url', remote], { cwd: root });
  if (r.status !== 0) return { ok: false, reason: `remote '${remote}' has no url configured` };
  const url = String(r.stdout || '').trim();
  if (!url) return { ok: false, reason: `remote '${remote}' has no url configured` };
  return { ok: true, url };
}

/**
 * N2 (GATE_L.md erratum): the effective PUSH destination, not just the fetch url. Refuses unless
 * `git remote get-url --push --all <r>` returns EXACTLY one URL equal to `namedUrl` (the URL the
 * question named). Covers pushurl, url.*.pushInsteadOf, url.*.insteadOf, and multiple `url` values —
 * all mechanically, from the one git call that already resolves every rewrite git itself applies.
 */
export function checkPushDestination(root, remote, namedUrl, runGit) {
  // `--all` here means "every configured push URL for this ONE remote, so we can prove there is
  // exactly one" — a read (`remote get-url`), never `push --all`/`fetch --all`'s bulk write. N2 needs
  // this exact flag; the ban below is aimed at bulk writes, not this read. F5: this exact array literal
  // is the ONE site N2_ALL_ALLOWANCE (above) pins — keep them byte-identical, or the self-scan reddens.
  const r = runGit(['remote', 'get-url', '--push', '--all', remote], { cwd: root });
  if (r.status !== 0) return { ok: false, reason: `git remote get-url --push --all failed for '${remote}'` };
  const urls = String(r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (urls.length !== 1) {
    return { ok: false, reason: `remote '${remote}' has ${urls.length} effective push URL(s), expected exactly one` };
  }
  if (urls[0] !== namedUrl) {
    return { ok: false, reason: `remote '${remote}' pushes to '${urls[0]}', not the named URL '${namedUrl}'` };
  }
  return { ok: true, url: urls[0] };
}

// ---- calls: a thin, timeout-bounded, non-throwing wrapper around git/gh ---------------------------

function realRunGit(args, opts = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', timeout: MAX_CALL_MS, killSignal: 'SIGKILL', ...opts });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

function realRunGh(args, opts = {}) {
  const r = spawnSync('gh', args, { encoding: 'utf8', timeout: MAX_CALL_MS, killSignal: 'SIGKILL', ...opts });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

function realRunShell(commandLine, opts = {}) {
  const r = spawnSync(commandLine, { shell: true, encoding: 'utf8', timeout: MAX_CALL_MS, killSignal: 'SIGKILL', ...opts });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function realFetch(url, opts = {}) {
  return fetch(url, { signal: AbortSignal.timeout(MAX_CALL_MS), ...opts });
}

// ---- the question (ask push / ask rerun) -----------------------------------------------------------

function utcNow(nowFn) {
  return (nowFn ? nowFn() : new Date()).toISOString();
}

function outboundStamp(date) {
  const iso = date.toISOString();
  const [datePart, timePart] = iso.split('T');
  return `${datePart}T${timePart.slice(0, 8).replace(/:/g, '')}Z`;
}

/**
 * The push question's rendered text — the SAME function builds it at `--ask` time and recomputes it
 * at `--record`/`--push` time. Any drift in url, ref, tip, base (a fresh ls-remote), or the seam's
 * deploy/smoke declaration changes this text, and therefore its hash (P3's "remote moved … deploy or
 * smoke added" red cases fall straight out of this single source of truth).
 */
export function buildPushQuestionText({ url, ref, tip, base, count, deploy }) {
  const lines = [
    `Push ${url} ${base.slice(0, 12)}..${tip.slice(0, 12)} to ${ref}?`,
    `${count} commit(s) on ${ref}, plus one commit on ${tip.slice(0, 12)} adding only this record.`,
    'No tags.',
  ];
  if (deploy && deploy.on_ref === ref) {
    lines.push(`This push deploys to ${deploy.target}.`);
    lines.push(`Smoke: ${deploy.smoke}`);
  } else {
    lines.push('No deploy declared for this ref.');
  }
  lines.push('');
  lines.push('A: push.');
  lines.push('B: hold.');
  lines.push('Reply with exactly the letter A or B.'); // N3
  return lines.join('\n');
}

export function buildRerunQuestionText({ runId, headSha, workflow, attempt }) {
  const lines = [
    `Re-run workflow ${workflow}, run ${runId}, attempt ${attempt}, headSha ${headSha.slice(0, 12)}?`,
    '',
    'A: rerun.',
    'B: hold.',
    'Reply with exactly the letter A or B.', // N3
  ];
  return lines.join('\n');
}

export function questionHash(text) {
  return crypto.createHash('sha256').update(lf(text), 'utf8').digest('hex');
}

// ---- record grammar: parse / render / append -------------------------------------------------------
//
// `.spire/clusters/tech/outbound/OUTBOUND-<UTC>.md` — one file per act. Header `Key: value` lines,
// then the full rendered question, then a `## Lines` section the tool only ever APPENDS to (P5: an
// act only ever adds bytes under outbound/, never rewrites an earlier one).

export function outboundDir(root) {
  return path.join(root, ...OUTBOUND_REL);
}

export function renderRecord(fields, questionText) {
  const header = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${header}\n\n## Question\n\n${questionText}\n\n## Lines\n`;
}

/**
 * F1 (repair round 1, critical): a header line that is neither `Key: value`-shaped nor a duplicate of
 * an earlier key REFUSES the whole record — never a silent drop/truncate/last-wins. This is the
 * structural defense-in-depth half of F1: even if some future writer ever puts a raw multi-line value
 * into the header (bypassing the CLI-level `containsLineBreak` refusal at --record), the resulting
 * continuation lines can only ever be (a) a duplicate key — refused — or (b) not `Key: value`-shaped —
 * also refused. Neither can silently overwrite a real field (P2-4, P3, §5(b)).
 */
export function parseRecord(text) {
  const body = lf(text);
  const qIdx = body.indexOf('\n## Question\n');
  const lIdx = body.indexOf('\n## Lines\n');
  if (qIdx === -1 || lIdx === -1) return null;
  const headerText = body.slice(0, qIdx);
  const questionText = body.slice(qIdx + '\n## Question\n'.length, lIdx).trim();
  const linesText = body.slice(lIdx + '\n## Lines\n'.length);
  const fields = {};
  const headerLines = headerText.split('\n');
  for (let i = 0; i < headerLines.length; i += 1) {
    const line = headerLines[i];
    // renderRecord always leaves exactly one trailing blank line at the header/Question boundary
    // (the header itself has no trailing '\n'); that lone trailing blank line is the only line this
    // parser ever tolerates without a Key: value shape.
    if (line === '' && i === headerLines.length - 1) continue;
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!m) return null; // an unrecognized header line refuses the whole record
    if (Object.prototype.hasOwnProperty.call(fields, m[1])) return null; // a duplicate header key refuses the whole record
    fields[m[1]] = m[2];
  }
  const lines = linesText.split('\n').filter((l) => l.startsWith('- '));
  return { fields, questionText, lines };
}

export function appendRecordLine(recordPath, line) {
  fs.appendFileSync(recordPath, `- ${line}\n`);
}

export function isConsumed(record) {
  return record.lines.some((l) => l.includes('ACT-RESULT:'));
}

// ---- CI verdict (§2, §5 S2) -------------------------------------------------------------------------

function classifyRun(detail) {
  if (!detail || detail.status !== 'completed') {
    return { code: 3, reason: `run ${detail?.databaseId ?? '?'} ${detail?.status ?? 'not found'}` };
  }
  const jobs = Array.isArray(detail.jobs) ? detail.jobs : [];
  const failedLegs = jobs.filter((j) => j.conclusion !== 'success').map((j) => j.name);
  if (detail.conclusion === 'success' && failedLegs.length === 0) {
    // F9 (minor): "every job success" is vacuous over zero jobs — an unreadable/empty jobs array is
    // unproven, never a pass (§3(1) "every job success", §3(2) "unreadable run ... fail or unproven").
    if (jobs.length === 0) {
      return { code: 4, reason: `run ${detail.databaseId} reported success with no jobs (unreadable)` };
    }
    return { code: 0, reason: 'pass', legs: [] };
  }
  if (FAIL_CONCLUSIONS.includes(detail.conclusion)) {
    // V1 (repair round 2): the fail verdict must NAME the failed legs (§2:28 "fail (...; legs named)"),
    // not merely compute them into a field cmdRead/cmdObserve never print — both write only `ci.reason`
    // (to stdout AND the record's READ line), so the legs belong in the reason text itself.
    const legsText = failedLegs.length > 0 ? ` (legs: ${failedLegs.join(', ')})` : '';
    return { code: 1, reason: `run ${detail.databaseId} concluded ${detail.conclusion}${legsText}`, legs: failedLegs };
  }
  return { code: 4, reason: `run ${detail.databaseId} concluded ${detail.conclusion}` };
}

/**
 * Y's own run only decides the verdict (C1); a descendant's run is never let stand in for it and is
 * reported as a separate `descendant <sha40>` line only.
 */
export function evaluateCi({ root, sha40, ref, workflow, deadlineMinutes, actAtMs, nowMs, persistedAttempt, runGh, runGit }) {
  const listArgs = ['run', 'list', '--commit', sha40, '--workflow', workflow, '--json', 'databaseId,headSha,status,conclusion,createdAt,attempt'];
  const listed = runGh(listArgs, {});
  let own = null;
  if (listed.status === 0) {
    try {
      const rows = JSON.parse(listed.stdout || '[]').filter((r) => r.headSha === sha40);
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      own = rows[0] || null;
    } catch {
      own = null;
    }
  }
  let result;
  if (own) {
    const attempt = persistedAttempt ?? own.attempt ?? 1;
    const viewed = runGh(['run', 'view', String(own.databaseId), '--attempt', String(attempt), '--json', 'databaseId,headSha,status,conclusion,jobs'], {});
    let detail = null;
    if (viewed.status === 0) {
      try { detail = JSON.parse(viewed.stdout || '{}'); } catch { detail = null; }
    }
    if (!detail) {
      result = { code: 4, reason: `unproven: gh run view failed for ${own.databaseId} attempt ${attempt}`, runId: own.databaseId, attempt };
    } else if (detail.headSha !== sha40) {
      // F9 (minor): "an other-SHA ... run scored" must be fail or unproven (§3(2)) — a run view reply
      // for a different headSha never stands in for this one's verdict.
      result = { code: 4, reason: `unproven: gh run view ${own.databaseId} attempt ${attempt} returned headSha ${String(detail.headSha).slice(0, 12)}, expected ${sha40.slice(0, 12)}`, runId: own.databaseId, attempt };
    } else {
      const c = classifyRun(detail);
      result = { code: c.code, reason: c.code === 0 ? 'pass' : `unproven: ${c.reason}`, legs: c.legs, runId: own.databaseId, attempt };
      if (c.code === 1) result.reason = `fail: ${c.reason}`;
      if (c.code === 3) result.reason = `pending: ${c.reason}`;
    }
  } else if (nowMs - actAtMs > deadlineMinutes * 60_000) {
    result = { code: 4, reason: `unproven: no terminal run covering ${sha40.slice(0, 12)} by ${deadlineMinutes}m deadline` };
  } else {
    result = { code: 3, reason: 'pending: no run found yet' };
  }

  // F8 (minor): an own run that is itself non-terminal (queued/in_progress) must ALSO become unproven
  // past the deadline — not stay "pending" forever. The no-run branch above already applies its own
  // deadline check, so this only ever fires for the "own run found, but not yet completed" case.
  if (result.code === 3 && nowMs - actAtMs > deadlineMinutes * 60_000) {
    result = { ...result, code: 4, reason: `unproven: ${result.reason.replace(/^pending: /, '')} past ${deadlineMinutes}m deadline` };
  }

  if (result.code !== 0 && ref) {
    const branchListed = runGh(['run', 'list', '--branch', ref, '--workflow', workflow, '--json', 'databaseId,headSha,status,conclusion,createdAt', '--limit', '20'], {});
    if (branchListed.status === 0) {
      try {
        const rows = JSON.parse(branchListed.stdout || '[]')
          .filter((r) => r.headSha !== sha40 && r.status === 'completed')
          .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
        for (const row of rows) {
          const anc = runGit(['merge-base', '--is-ancestor', sha40, row.headSha], { cwd: root });
          if (anc.status === 0) {
            result.descendantSha = row.headSha;
            break;
          }
        }
      } catch {
        // no fetch, no crash — an unreadable branch list just means no descendant line.
      }
    }
  }
  return result;
}

// ---- deploy verdict (§2 seam; C11, C13) --------------------------------------------------------------

const SHA40_RE = /[0-9a-f]{40}/;

export async function evaluateDeploy({ root, deploy, targetSha, nowMs, actAtMs, fetchImpl, runShell, runGit }) {
  let revRes;
  try {
    revRes = await fetchImpl(deploy.revision_url);
  } catch (e) {
    return { code: 4, reason: `unproven: revision_url unreachable: ${e.message}` };
  }
  // below hard ground (audit map_unmappable note): honour the HTTP status — a non-2xx reply (e.g. an
  // error page that happens to contain a stray 40-hex string) never counts as a revision.
  if (revRes.status < 200 || revRes.status >= 300) {
    return { code: 4, reason: `unproven: revision_url returned status ${revRes.status}` };
  }
  const body = await revRes.text();
  const match = SHA40_RE.exec(body);
  if (!match) return { code: 4, reason: 'unproven: no revision found in body (B25)' };
  const revision = match[0];
  if (revision !== targetSha) {
    // F10 (minor): an unknown-locally revision (never fetched) is unproven — NEVER scored as a proven
    // non-descendant. merge-base exits non-zero (1) for a proven non-ancestor AND (128) for an object
    // this clone has never seen; checking locality FIRST (C11: "superseding is no failure") stops a
    // superseding-but-unfetched revision from being misread as a hard fail.
    if (!shaIsLocal(root, revision, runGit)) {
      return { code: 4, reason: `unproven: revision unknown locally: ${revision.slice(0, 12)}`, revision };
    }
    const anc = runGit(['merge-base', '--is-ancestor', targetSha, revision], { cwd: root });
    if (anc.status === 0) {
      return { code: 4, reason: `unproven: revision ${revision.slice(0, 12)} supersedes ${targetSha.slice(0, 12)}`, revision };
    }
    if (nowMs - actAtMs > deploy.deadline_min * 60_000) {
      return { code: 1, reason: `fail: revision ${revision.slice(0, 12)} does not descend from ${targetSha.slice(0, 12)} past deadline`, revision };
    }
    return { code: 3, reason: 'pending: revision does not yet match', revision };
  }
  let healthRes;
  try {
    healthRes = await fetchImpl(deploy.health_url);
  } catch (e) {
    return { code: 1, reason: `fail: health unreachable: ${e.message} — old version still live`, revision };
  }
  if (healthRes.status < 200 || healthRes.status >= 300) {
    return { code: 1, reason: `fail: health ${healthRes.status} — old version still live`, revision };
  }
  const smoke = runShell(deploy.smoke, {});
  if (smoke.status !== 0) {
    return { code: 1, reason: `fail: smoke exit ${smoke.status} — old version still live`, revision };
  }
  return { code: 0, reason: `pass: revision ${targetSha.slice(0, 12)} confirmed, health ok, smoke ok`, revision };
}

// ---- CLI --------------------------------------------------------------------------------------------

function usage() {
  return [
    'usage: node outbound.mjs --ask push --remote <r> --ref <b> --tip <sha40> [--root <path>]',
    '       node outbound.mjs --ask rerun --run <id> [--root <path>]',
    '       node outbound.mjs --record --ask push --remote <r> --ref <b> --tip <sha40> --hash <h> --answer "<verbatim>"',
    '       node outbound.mjs --record --ask rerun --run <id> --hash <h> --answer "<verbatim>"',
    '       node outbound.mjs --push [--root <path>]',
    '       node outbound.mjs --rerun [--root <path>]',
    '       node outbound.mjs --read [--record-path <path>] [--root <path>]',
    '       node outbound.mjs --observe --remote <r> --ref <b> --sha <sha40> [--root <path>]',
  ].join('\n');
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function outboundSeam(root) {
  const cfg = projectConfig(root);
  return cfg && typeof cfg === 'object' ? cfg.outbound : undefined;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {string[]} argv script-first convention (argv[0] ignored), like closure.mjs.
 * @param {{root?: string, runGit?: Function, runGh?: Function, runShell?: Function,
 *   fetchImpl?: Function, now?: () => Date}} [injected]
 */
export function main(argv, injected = {}) {
  const raw = argv.slice(1);
  const args = parseArgs(raw);
  const effectiveRoot = injected.root || args.root || ROOT;
  const runGit = injected.runGit || realRunGit;
  const runGh = injected.runGh || realRunGh;
  const runShell = injected.runShell || realRunShell;
  const fetchImpl = injected.fetchImpl || realFetch;
  const nowFn = injected.now || (() => new Date());

  const seam = outboundSeam(effectiveRoot);
  if (!isPlainObject(seam)) {
    console.log('unproven: not declared');
    return 4;
  }

  // `--record` is ALWAYS invoked with its own `--ask <verb> ...` args re-supplied (§2 line 20), so
  // `args.ask` is defined on every `--record` call too. --record must be checked FIRST, or it is
  // unreachable: every `--record …` call would silently re-run --ask instead and write nothing.
  if (args.record === true) return cmdRecord(effectiveRoot, args, seam, { runGit, runGh, nowFn });
  if (args.ask !== undefined) return cmdAsk(effectiveRoot, args, seam, { runGit, runGh, nowFn });
  if (args.push === true) return cmdPush(effectiveRoot, seam, { runGit, nowFn });
  if (args.rerun === true) return cmdRerun(effectiveRoot, seam, { runGit, runGh, nowFn });
  if (args.read === true) return cmdRead(effectiveRoot, args, seam, { runGit, runGh, runShell, fetchImpl, nowFn });
  if (args.observe === true) return cmdObserve(effectiveRoot, args, seam, { runGit, runGh, nowFn });

  console.log(usage());
  return 2;
}

function refuse(reason) {
  console.log(`refused: ${reason}`);
  return 2;
}

/** F11 (minor): §2 line 18's "--ask refuses unless ... nothing staged, outbound/ clean" sits in the
 * §2 preamble, before push AND rerun — it binds every --ask, not only --ask push. */
function askCleanPreflight(root, runGit) {
  const staged = runGit(['diff', '--cached', '--name-only'], { cwd: root });
  if (staged.status !== 0 || staged.stdout.trim() !== '') return { ok: false, reason: 'staged changes present; --ask needs a clean index' };
  const dirty = runGit(['status', '--porcelain', '--', path.join(...OUTBOUND_REL)], { cwd: root });
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') return { ok: false, reason: 'outbound/ is not clean' };
  return { ok: true };
}

function askPreflight(root, tip, runGit) {
  const head = runGit(['rev-parse', 'HEAD'], { cwd: root });
  if (head.status !== 0) return { ok: false, reason: 'cannot resolve HEAD' };
  if (head.stdout.trim() !== tip) return { ok: false, reason: `--tip ${tip.slice(0, 12)} is not HEAD (${head.stdout.trim().slice(0, 12)})` };
  return askCleanPreflight(root, runGit);
}

function askPushFields(root, args, seam, deps) {
  if (!validateSha40Format(args.tip)) return { ok: false, reason: `--tip must be 40 lowercase hex chars: ${args.tip}` };
  if (!shaIsLocal(root, args.tip, deps.runGit)) return { ok: false, reason: `--tip ${args.tip.slice(0, 12)} is not a local commit` };
  if (!validateRefName(args.ref)) return { ok: false, reason: `invalid --ref: ${args.ref}` };
  const base = validateRemoteBasic(root, args.remote, deps.runGit);
  if (!base.ok) return base;
  const dest = checkPushDestination(root, args.remote, base.url, deps.runGit);
  if (!dest.ok) return dest;
  const pre = askPreflight(root, args.tip, deps.runGit);
  if (!pre.ok) return pre;
  const lsRemote = deps.runGit([VERB_LS_REMOTE, args.remote, `refs/heads/${args.ref}`], { cwd: root });
  if (lsRemote.status !== 0) return { ok: false, reason: `${VERB_LS_REMOTE} failed for ${args.remote}` };
  const line = lsRemote.stdout.split('\n').find((l) => l.trim() !== '');
  const baseSha = line ? line.split(/\s+/)[0] : null;
  if (!baseSha) return { ok: false, reason: `ref ${args.ref} not found on ${args.remote}` };
  if (!shaIsLocal(root, baseSha, deps.runGit)) return { ok: false, reason: `remote tip ${baseSha.slice(0, 12)} is unknown locally (no fetch)` };
  const anc = deps.runGit(['merge-base', '--is-ancestor', baseSha, args.tip], { cwd: root });
  if (anc.status !== 0) return { ok: false, reason: `remote tip ${baseSha.slice(0, 12)} is not an ancestor of ${args.tip.slice(0, 12)}` };
  const countRes = deps.runGit(['rev-list', '--count', `${baseSha}..${args.tip}`], { cwd: root });
  const count = countRes.status === 0 ? countRes.stdout.trim() : '?';
  const questionText = buildPushQuestionText({ url: base.url, ref: args.ref, tip: args.tip, base: baseSha, count, deploy: seam.deploy });
  return {
    ok: true,
    url: base.url,
    baseSha,
    questionText,
    fields: {
      Act: VERB_PUSH,
      Remote: args.remote,
      URL: base.url,
      Ref: args.ref,
      Tip: args.tip,
      Base: baseSha,
    },
  };
}

function askRerunFields(root, args, seam, deps) {
  const pre = askCleanPreflight(root, deps.runGit);
  if (!pre.ok) return pre;
  if (!args.run) return { ok: false, reason: '--run is required for --ask rerun' };
  const viewed = deps.runGh(['run', 'view', String(args.run), '--json', 'databaseId,headSha,workflowName,attempt'], {});
  if (viewed.status !== 0) return { ok: false, reason: `gh run view ${args.run} failed` };
  let detail;
  try { detail = JSON.parse(viewed.stdout || '{}'); } catch { return { ok: false, reason: `gh run view ${args.run} returned unreadable JSON` }; }
  if (!detail.headSha || !detail.workflowName) return { ok: false, reason: `gh run view ${args.run} is missing headSha/workflowName` };
  const questionText = buildRerunQuestionText({ runId: args.run, headSha: detail.headSha, workflow: detail.workflowName, attempt: detail.attempt ?? 1 });
  return {
    ok: true,
    questionText,
    fields: {
      Act: VERB_RERUN,
      Run: String(args.run),
      HeadSha: detail.headSha,
      Workflow: detail.workflowName,
      Attempt: String(detail.attempt ?? 1),
    },
  };
}

function askFieldsFor(root, args, seam, deps) {
  if (args.ask === VERB_PUSH) return askPushFields(root, args, seam, deps);
  if (args.ask === VERB_RERUN) return askRerunFields(root, args, seam, deps);
  return { ok: false, reason: `--ask must be ${VERB_PUSH} or ${VERB_RERUN}, got: ${args.ask}` };
}

function cmdAsk(root, args, seam, deps) {
  const built = askFieldsFor(root, args, seam, { runGit: deps.runGit, runGh: deps.runGh });
  if (!built.ok) return refuse(built.reason);
  console.log(built.questionText);
  console.log(`hash: ${questionHash(built.questionText)}`);
  return 0;
}

function cmdRecord(root, args, seam, deps) {
  if (!args.hash || typeof args.answer !== 'string') return refuse('--record needs --hash and --answer');
  // F1 (critical): refuse a line break in --answer BEFORE any call or write — the raw answer is
  // embedded verbatim into the record header (renderRecord), and a line break there can inject a
  // Key: value-shaped continuation line that overwrites a real field on parse (P2-4, P3, §5(b)).
  if (containsLineBreak(args.answer)) return refuse('--answer must not contain a line break (CR, LF, U+2028 or U+2029)');
  const built = askFieldsFor(root, args, seam, { runGit: deps.runGit, runGh: deps.runGh });
  if (!built.ok) return refuse(built.reason);
  const recomputed = questionHash(built.questionText);
  if (recomputed !== args.hash) return refuse(`hash does not recompute (world moved since --ask): got ${recomputed}, expected ${args.hash}`);
  const now = deps.nowFn();
  const nowIso = utcNow(deps.nowFn);
  const dir = outboundDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const recordPath = path.join(dir, `OUTBOUND-${outboundStamp(now)}.md`);
  const fields = { ...built.fields, 'Question-Hash': args.hash, Answer: args.answer, 'Answered-At': nowIso };
  // F12 (minor): exclusive create — two records stamped in the same UTC second must never overwrite
  // each other (P5: post-archive writes only ADD dated files).
  try {
    fs.writeFileSync(recordPath, renderRecord(fields, built.questionText), { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') return refuse(`record already exists: ${path.relative(root, recordPath)} (same-second collision)`);
    throw e;
  }
  console.log(`wrote ${path.relative(root, recordPath)}`);
  return 0;
}

/** HEAD = Y adds only one new file, T's one child: the record `--push`/`--rerun` will act on. */
function findActRecord(root, runGit) {
  const parents = runGit(['rev-list', '--parents', '-n', '1', 'HEAD'], { cwd: root });
  if (parents.status !== 0) return { ok: false, reason: 'cannot resolve HEAD' };
  const shas = parents.stdout.trim().split(/\s+/);
  if (shas.length !== 2) return { ok: false, reason: 'HEAD is not a single-parent commit (Y must be a plain child of T)' };
  const [y, t] = shas;
  const added = runGit(['diff', '--diff-filter=A', '--name-only', t, y], { cwd: root });
  const all = runGit(['diff', '--name-only', t, y], { cwd: root });
  if (added.status !== 0 || all.status !== 0) return { ok: false, reason: 'cannot diff T..Y' };
  const addedFiles = added.stdout.trim().split('\n').filter(Boolean);
  const allFiles = all.stdout.trim().split('\n').filter(Boolean);
  if (allFiles.length !== 1 || addedFiles.length !== 1) {
    return { ok: false, reason: `HEAD (Y) touches ${allFiles.length} file(s), must add exactly one record` };
  }
  const relPath = allFiles[0];
  const outboundPrefix = OUTBOUND_REL.join('/');
  if (!relPath.startsWith(`${outboundPrefix}/`)) {
    return { ok: false, reason: `HEAD (Y) adds ${relPath}, not a file under ${outboundPrefix}/` };
  }
  const abs = path.join(root, ...relPath.split('/'));
  // F4 (major): the answer a --push/--rerun acts on must be COMMITTED first (§1, §3, P3) — read the
  // record from Y's OWN committed blob (`git show`), never the mutable working tree. The working tree
  // is tolerated ONLY as that exact blob, optionally followed by the tool's own appended '- ' lines
  // (its own prior ACT-RESULT/READ lines) — any other divergence (e.g. a committed 'B' silently edited
  // to 'A' on disk) refuses.
  const shown = runGit(['show', `${y}:${relPath}`], { cwd: root });
  if (shown.status !== 0) return { ok: false, reason: `cannot read ${relPath} from commit ${y.slice(0, 12)} (Y)` };
  const committedText = shown.stdout;
  if (!fs.existsSync(abs)) return { ok: false, reason: `${relPath} is not on disk (uncommitted?)` };
  const workingText = fs.readFileSync(abs, 'utf8');
  if (workingText !== committedText) {
    const startsWithCommitted = workingText.startsWith(committedText);
    const suffix = startsWithCommitted ? workingText.slice(committedText.length) : '';
    const suffixLines = suffix.length > 0 ? suffix.split('\n').filter((l) => l.length > 0) : [];
    const suffixIsOnlyAppendedLines = startsWithCommitted && suffixLines.every((l) => l.startsWith('- '));
    if (!suffixIsOnlyAppendedLines) {
      return { ok: false, reason: `${relPath} working tree differs from the committed blob at ${y.slice(0, 12)} (Y) — the answer must be committed first` };
    }
  }
  // Parse the WORKING text, not the committed blob: the tolerance check above already proves the
  // working text's header/question section is byte-identical to the committed blob (any legitimate
  // suffix only ever adds '## Lines' entries), so this picks up the tool's own prior ACT-RESULT/READ
  // lines (isConsumed, attempt persistence) — reading committedText alone would make `isConsumed`
  // permanently false, since those lines are only ever appended AFTER Y is already committed.
  const record = parseRecord(workingText);
  if (!record) return { ok: false, reason: `${relPath} is not a readable outbound record` };
  return { ok: true, y, t, path: abs, relPath, record };
}

function cmdPush(root, seam, deps) {
  const found = findActRecord(root, deps.runGit);
  if (!found.ok) return refuse(found.reason);
  const { record, y, t, path: recordPath } = found;
  if (record.fields.Act !== VERB_PUSH) return refuse(`record Act is '${record.fields.Act}', not '${VERB_PUSH}'`);
  if (isConsumed(record)) return refuse('record is already used');
  const answer = (record.fields.Answer ?? '').trim();
  if (answer !== 'A' && answer !== 'a') return refuse(`answer must be exactly 'A' or 'a', got: ${JSON.stringify(record.fields.Answer)}`);
  // F1 (critical): the record's OWN persisted Question text must hash to its OWN Question-Hash field —
  // a record that is internally inconsistent (e.g. a Question-Hash forged to match different fields
  // while the persisted ## Question section stays stale) refuses here, independent of whether a fresh
  // recompute happens to agree with the (forged) Question-Hash field.
  if (questionHash(record.questionText) !== record.fields['Question-Hash']) {
    return refuse('record Question-Hash does not match its own stored question text (record tampered)');
  }
  const { Remote: remote, URL: url, Ref: ref, Tip: tip } = record.fields;
  if (record.fields.Tip !== t) return refuse(`record Tip ${tip?.slice(0, 12)} does not match T (${t.slice(0, 12)}) — tip changed`);
  const dest = checkPushDestination(root, remote, url, deps.runGit);
  if (!dest.ok) return refuse(dest.reason);
  const lsRemote = deps.runGit([VERB_LS_REMOTE, remote, `refs/heads/${ref}`], { cwd: root });
  if (lsRemote.status !== 0) return refuse(`${VERB_LS_REMOTE} failed for ${remote}`);
  const line = lsRemote.stdout.split('\n').find((l) => l.trim() !== '');
  const freshBase = line ? line.split(/\s+/)[0] : null;
  if (!freshBase) return refuse(`ref ${ref} not found on ${remote}`);
  const anc = deps.runGit(['merge-base', '--is-ancestor', freshBase, tip], { cwd: root });
  if (anc.status !== 0) return refuse(`remote tip ${freshBase.slice(0, 12)} is not an ancestor of ${tip.slice(0, 12)}`);
  const countRes = deps.runGit(['rev-list', '--count', `${freshBase}..${tip}`], { cwd: root });
  const count = countRes.status === 0 ? countRes.stdout.trim() : '?';
  const recomputedText = buildPushQuestionText({ url, ref, tip, base: freshBase, count, deploy: seam.deploy });
  // F1 (byte-for-byte binding): compare the recomputed TEXT against the record's own persisted
  // Question text, not merely a hash-vs-hash comparison — this also subsumes the old hash check for
  // every legitimate case (equal text implies equal hash), while closing the header-injection hole a
  // hash-only comparison cannot see (F1).
  if (recomputedText !== record.questionText) {
    const recomputedHash = questionHash(recomputedText);
    return refuse(`hash does not recompute at push time (remote moved, or deploy/smoke changed): got ${recomputedHash}, expected ${record.fields['Question-Hash']}`);
  }
  const argv = [VERB_PUSH, '--no-follow-tags', remote, `${y}:refs/heads/${ref}`];
  const pushed = deps.runGit(argv, { cwd: root });
  const nowIso = utcNow(deps.nowFn);
  appendRecordLine(recordPath, `ACT-RESULT: push exit=${pushed.status} at=${nowIso} argv=${JSON.stringify(argv)} ls-remote=${freshBase}`);
  if (pushed.status !== 0) {
    console.log(`push failed: exit ${pushed.status}: ${pushed.stderr}`);
    return 1;
  }
  console.log(`push done: ${y.slice(0, 12)} -> ${remote}/${ref}`);
  return 0;
}

function cmdRerun(root, seam, deps) {
  // rerun needs git only to find the record (HEAD/T diff), same as --push.
  const found = findActRecord(root, deps.runGit);
  if (!found.ok) return refuse(found.reason);
  const { record, path: recordPath } = found;
  if (record.fields.Act !== VERB_RERUN) return refuse(`record Act is '${record.fields.Act}', not '${VERB_RERUN}'`);
  if (isConsumed(record)) return refuse('record is already used');
  const answer = (record.fields.Answer ?? '').trim();
  if (answer !== 'A' && answer !== 'a') return refuse(`answer must be exactly 'A' or 'a', got: ${JSON.stringify(record.fields.Answer)}`);
  // F1 (critical): see the matching check in cmdPush.
  if (questionHash(record.questionText) !== record.fields['Question-Hash']) {
    return refuse('record Question-Hash does not match its own stored question text (record tampered)');
  }
  const { Run: runId, HeadSha: headSha } = record.fields;
  const viewed = deps.runGh(['run', 'view', String(runId), '--json', 'databaseId,headSha,workflowName,attempt'], {});
  if (viewed.status !== 0) return refuse(`gh run view ${runId} failed`);
  let detail;
  try { detail = JSON.parse(viewed.stdout || '{}'); } catch { return refuse(`gh run view ${runId} returned unreadable JSON`); }
  // F6 (major): recompute with the FRESH attempt from gh run view — NEVER the recorded one — so a run
  // re-attempted (e.g. by hand, outside this tool) between --record and --rerun fails the recompute,
  // the same way a fresh B (not the recorded one) is used at push time.
  const recomputedText = buildRerunQuestionText({ runId, headSha: detail.headSha, workflow: detail.workflowName, attempt: detail.attempt ?? 1 });
  if (recomputedText !== record.questionText) {
    const recomputedHash = questionHash(recomputedText);
    return refuse(`hash does not recompute at rerun time: got ${recomputedHash}, expected ${record.fields['Question-Hash']}`);
  }
  if (detail.headSha !== headSha) return refuse(`run ${runId} headSha changed since ask: ${detail.headSha}`);
  const argv = ['run', VERB_RERUN, String(runId)];
  const reran = deps.runGh(argv, {});
  const nowIso = utcNow(deps.nowFn);
  appendRecordLine(recordPath, `ACT-RESULT: rerun exit=${reran.status} at=${nowIso} argv=${JSON.stringify(argv)}`);
  if (reran.status !== 0) {
    console.log(`rerun failed: exit ${reran.status}: ${reran.stderr}`);
    return 1;
  }
  console.log(`rerun done: run ${runId}`);
  return 0;
}

function findOpenRecord(root, explicitPath) {
  if (explicitPath) {
    const abs = path.isAbsolute(explicitPath) ? explicitPath : path.join(root, explicitPath);
    if (!fs.existsSync(abs)) return { ok: false, reason: `no such record: ${explicitPath}` };
    const record = parseRecord(fs.readFileSync(abs, 'utf8'));
    if (!record) return { ok: false, reason: `${explicitPath} is not a readable outbound record` };
    return { ok: true, path: abs, record };
  }
  const dir = outboundDir(root);
  if (!fs.existsSync(dir)) return { ok: false, reason: 'no outbound records found' };
  const candidates = fs.readdirSync(dir)
    .filter((n) => /^OUTBOUND-.*\.md$/.test(n))
    .map((n) => path.join(dir, n))
    .map((p) => ({ path: p, record: parseRecord(fs.readFileSync(p, 'utf8')) }))
    .filter((c) => c.record && isConsumed(c.record) && !c.record.lines.some((l) => l.includes('READ: ci verdict=pass') || l.includes('READ: ci verdict=fail') || l.includes('READ: ci verdict=unproven')));
  if (candidates.length === 0) return { ok: false, reason: 'no open (pushed/rerun, unread) record found; pass --record-path' };
  if (candidates.length > 1) return { ok: false, reason: `${candidates.length} open records found; pass --record-path to disambiguate` };
  return { ok: true, path: candidates[0].path, record: candidates[0].record };
}

/**
 * Y is the record's OWN commit — the pushed ref moves to Y (T's one child), never to T (§2, C1/C2).
 * `record.fields.Tip` holds T, not Y, so CI must be read against the commit that ADDED this exact
 * record file, found from git history (the record is append-only afterward, so the add event is
 * unique and stable regardless of where HEAD has moved since).
 */
function findRecordCommit(root, relPath, runGit) {
  const gitPath = relPath.split(path.sep).join('/');
  const log = runGit(['log', '--diff-filter=A', '--format=%H', '--', gitPath], { cwd: root });
  if (log.status !== 0) return null;
  const shas = log.stdout.trim().split('\n').filter(Boolean);
  return shas.length > 0 ? shas[shas.length - 1] : null;
}

/**
 * F2 (critical): a pass must never stand without an ls-remote line at Y committed to the record
 * FIRST. Downgrades an otherwise-passing `ci` in place: still within the deadline ⇒ pending (3);
 * past it ⇒ unproven (4). Only ever called when `ci.code === 0` — a non-pass verdict is untouched.
 */
function downgradeWithoutLsRemoteConfirmation(ci, remoteSha, targetSha, nowMs, actAtMs, deadlineMinutes) {
  if (remoteSha === targetSha) return ci;
  if (nowMs - actAtMs > deadlineMinutes * 60_000) {
    return { ...ci, code: 4, reason: `unproven: ls-remote ${remoteSha ? remoteSha.slice(0, 12) : '(absent)'} does not confirm Y (${targetSha.slice(0, 12)})` };
  }
  return { ...ci, code: 3, reason: 'pending: ls-remote does not yet confirm Y' };
}

async function cmdRead(root, args, seam, deps) {
  const found = findOpenRecord(root, args['record-path']);
  if (!found.ok) return refuse(found.reason);
  const { record, path: recordPath } = found;
  let targetSha;
  if (record.fields.Act === VERB_PUSH) {
    targetSha = findRecordCommit(root, path.relative(root, recordPath), deps.runGit);
    if (!targetSha) return refuse(`cannot resolve Y: no commit adds ${path.relative(root, recordPath)}`);
  } else {
    targetSha = record.fields.HeadSha;
  }
  const actAtLine = record.lines.find((l) => l.includes('ACT-RESULT:'));
  const actAtMatch = actAtLine && /at=([^\s]+)/.exec(actAtLine);
  const actAtMs = actAtMatch ? Date.parse(actAtMatch[1]) : Date.parse(record.fields['Answered-At']);
  const nowMs = deps.nowFn().getTime();
  const deadlineMinutes = seam.ci?.deadline_min ?? 90;

  // F2 (critical): ls-remote at Y, appended BEFORE any verdict line (§1, §3(1), §5(a): "a pass line
  // after no ls-remote line at Y"). Push records have a Remote/Ref to check against; rerun records
  // record neither (they push nothing), so there is no ref to ls-remote for them.
  let remoteSha = null;
  if (record.fields.Act === VERB_PUSH) {
    const remote = record.fields.Remote;
    const ref = record.fields.Ref;
    const lsRemote = deps.runGit([VERB_LS_REMOTE, remote, `refs/heads/${ref}`], { cwd: root });
    const line = lsRemote.status === 0 ? lsRemote.stdout.split('\n').find((l) => l.trim() !== '') : null;
    remoteSha = line ? line.split(/\s+/)[0] : null;
    appendRecordLine(recordPath, `READ: ls-remote ${remote}/${ref} = ${remoteSha ?? '(absent)'}`);
  }

  const persistedAttempt = (() => {
    const m = record.lines.map((l) => /attempt=(\d+)/.exec(l)).find(Boolean);
    return m ? Number(m[1]) : undefined;
  })();
  if (!isPlainObject(seam.ci) || seam.ci.reader !== 'gh') {
    appendRecordLine(recordPath, 'READ: ci verdict=unproven reason=no reader declared');
    console.log('unproven: no reader declared');
    return 4;
  }
  let ci = evaluateCi({
    root, sha40: targetSha, ref: record.fields.Act === VERB_PUSH ? record.fields.Ref : undefined,
    workflow: seam.ci.workflow, deadlineMinutes, actAtMs, nowMs, persistedAttempt, runGh: deps.runGh, runGit: deps.runGit,
  });
  if (record.fields.Act === VERB_PUSH && ci.code === 0) {
    ci = downgradeWithoutLsRemoteConfirmation(ci, remoteSha, targetSha, nowMs, actAtMs, deadlineMinutes);
  }
  appendRecordLine(recordPath, `READ: ci run=${ci.runId ?? ''} attempt=${ci.attempt ?? ''} verdict=${ci.code === 0 ? 'pass' : ci.code === 1 ? 'fail' : ci.code === 3 ? 'pending' : 'unproven'} reason=${ci.reason}`);
  if (ci.descendantSha) appendRecordLine(recordPath, `READ: descendant ${ci.descendantSha}`);
  console.log(ci.reason);

  // F3 (major): the deploy read and its smoke run ONLY when the record's own yes named them — a push
  // to the seam's declared deploy.on_ref (C6 "smoke only under its yes"; P3 "the yes names ... deploy,
  // smoke"). Never for an off-ref push, and never for a rerun record (its question names no deploy).
  // Below hard ground: a named smoke runs AT MOST ONCE per record (§2:22) — `--read --record-path`
  // can otherwise re-read (and re-run the smoke for) an already-deployed record on every call.
  const alreadyDeployed = record.lines.some((l) => l.includes('READ: deploy verdict='));
  if (isPlainObject(seam.deploy) && ci.code === 0 && record.fields.Act === VERB_PUSH && record.fields.Ref === seam.deploy.on_ref && !alreadyDeployed) {
    const deploy = await evaluateDeploy({
      root, deploy: seam.deploy, targetSha, nowMs, actAtMs,
      fetchImpl: deps.fetchImpl, runShell: deps.runShell, runGit: deps.runGit,
    });
    // F10 (minor, C13): a full, separate revision line on every deploy read — catches misordering,
    // not merely a false revision — written BEFORE the verdict line.
    if (deploy.revision) appendRecordLine(recordPath, `READ: revision ${deploy.revision}`);
    appendRecordLine(recordPath, `READ: deploy verdict=${deploy.code === 0 ? 'pass' : deploy.code === 1 ? 'fail' : deploy.code === 3 ? 'pending' : 'unproven'} reason=${deploy.reason}`);
    console.log(deploy.reason);
    return deploy.code;
  }
  return ci.code;
}

async function cmdObserve(root, args, seam, deps) {
  if (!validateSha40Format(args.sha)) return refuse(`--sha must be 40 lowercase hex chars: ${args.sha}`);
  // F7 (minor): a SHA must be local, never expanded/fetched (§2:24) — before any call or write.
  if (!shaIsLocal(root, args.sha, deps.runGit)) return refuse(`--sha ${args.sha.slice(0, 12)} is not a local commit`);
  if (!validateRefName(args.ref)) return refuse(`invalid --ref: ${args.ref}`);
  const base = validateRemoteBasic(root, args.remote, deps.runGit);
  if (!base.ok) return refuse(base.reason);
  const lsRemote = deps.runGit([VERB_LS_REMOTE, args.remote, `refs/heads/${args.ref}`], { cwd: root });
  const line = lsRemote.status === 0 ? lsRemote.stdout.split('\n').find((l) => l.trim() !== '') : null;
  const remoteSha = line ? line.split(/\s+/)[0] : null;

  const now = deps.nowFn();
  const dir = outboundDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const recordPath = path.join(dir, `OUTBOUND-${outboundStamp(now)}.md`);
  const fields = { Act: 'observe', Remote: args.remote, URL: base.url, Ref: args.ref, Sha: args.sha };
  // F12 (minor): exclusive create — see the matching check in cmdRecord.
  try {
    fs.writeFileSync(recordPath, renderRecord(fields, '(no question — observe records no yes, smoke or act)'), { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') return refuse(`record already exists: ${path.relative(root, recordPath)} (same-second collision)`);
    throw e;
  }
  appendRecordLine(recordPath, `READ: ls-remote ${args.remote}/${args.ref} = ${remoteSha ?? '(absent)'}`);

  if (!isPlainObject(seam.ci) || seam.ci.reader !== 'gh') {
    appendRecordLine(recordPath, 'READ: ci verdict=unproven reason=no reader declared');
    console.log('unproven: no reader declared');
    return 4;
  }
  const nowMs = now.getTime();
  const deadlineMinutes = seam.ci.deadline_min ?? 90;
  let ci = evaluateCi({
    root, sha40: args.sha, ref: args.ref, workflow: seam.ci.workflow, deadlineMinutes,
    actAtMs: nowMs, nowMs, persistedAttempt: undefined, runGh: deps.runGh, runGit: deps.runGit,
  });
  // F2 (critical): score pass only when ls-remote confirms --sha (Y, for observe).
  if (ci.code === 0) ci = downgradeWithoutLsRemoteConfirmation(ci, remoteSha, args.sha, nowMs, nowMs, deadlineMinutes);
  appendRecordLine(recordPath, `READ: ci run=${ci.runId ?? ''} attempt=${ci.attempt ?? ''} verdict=${ci.code === 0 ? 'pass' : ci.code === 1 ? 'fail' : ci.code === 3 ? 'pending' : 'unproven'} reason=${ci.reason}`);
  if (ci.descendantSha) appendRecordLine(recordPath, `READ: descendant ${ci.descendantSha}`);
  console.log(ci.reason);
  return ci.code;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const code = main(['outbound.mjs', ...process.argv.slice(2)]);
  process.exitCode = code instanceof Promise ? await code : code;
}
