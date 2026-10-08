#!/usr/bin/env node
// closure.mjs — the close sweep tool (close-sweep T1, roadmap item 18).
//
// A picked backlog item's terminal exit (shipped | killed | parked | empty) must update its backlog
// line, ripple through planning/memory files, and rule every doc that still names it — a blocking
// check, not a checklist (owner ruling R3). This tool is the mechanism: it scans a contract folder for
// what needs ruling, records the ruling in CLOSURE.md, and writes back ONLY the tech-owned facts
// (outcome, reason, evidence, unranked follow-up intake) once every flag clears (R7 — never product
// order/value/problem, never "last groomed").
//
// Usage:
//   node closure.mjs <folder> --scan
//   node closure.mjs <folder> --close [--follow-up "<text>"]...
//   node closure.mjs <folder> --check
//   node closure.mjs --debt [--root <path>]
//
// <folder> is an absolute path, or a bare slug resolved under contracts/ then contracts/_archive/
// (ascent inferred the way `contract_lint.mjs`'s `classifyContractFolder` infers a folder's family).
// Every exported function takes an explicit `root` (continuity.mjs:236 precedent) rather than
// deriving one from this file's own install location, so a kit-meta caller (release.mjs) or a test
// can point it at any tree. Node builtins only — no dependency, this file ships into every consumer.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { projectConfig } from './_project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const ARROW = '→'; // → — the literal character CULL_METHOD.md/ORCHESTRATOR.md use for a pick marker.
const OUTCOMES = Object.freeze(['shipped', 'killed', 'parked', 'empty']);
const HASH_LEN = 12;

// Duplicated from the kit's own release script rather than imported: this tool is INSTALLED into
// every consumer (framework_files), the release script is kit-meta and never ships past this repo,
// so an import here would crash on the first consumer install. tests/clusters/tech/tools/closure.test.mjs
// asserts source-string equality against that script's own export so the two patterns cannot drift
// silently (the same duplicate-with-a-test-pin shape release.mjs already uses for NARRATIVE_FILES vs
// kit_lint's VERSION_NARRATIVE_FILES).
export const NARRATIVE_VERSION_RE = /\b(?:Spire OS|spire-os)[^\r\n]{0,40}?\bv?(\d+\.\d+\.\d+)\b/giu;

// Grammar shared by BRIEF §4a / CULL.md's pointer AND release.mjs's `Change:` field — both are
// "<slug> | none (<reason>)". `parsePointerValue` is deliberately generic enough for both callers.
const ANCHOR_SOURCE = '[a-z0-9]+(?:-[a-z0-9]+)*';
const POINTER_LINE_RE = /^[ \t]*\*{0,2}[ \t]*Backlog item:[ \t]*\*{0,2}[ \t]*(.+?)[ \t]*$/im;
const POINTER_VALUE_RE = new RegExp(`^none\\s*\\(([^)]*)\\)$|^(${ANCHOR_SOURCE})$`, 'i');

function lf(text) {
  return String(text).replace(/\r\n/g, '\n');
}

/** Hash: 12 hex, LF-normalized — so a CRLF-only edit never counts as a content change. */
export function hashText(text) {
  return crypto.hash('sha256', lf(text), 'hex').slice(0, HASH_LEN);
}

/** The three default Terms forms a slug expands into. Order is hyphen, underscore, space. */
export function slugTerms(slug) {
  return [...new Set([slug, slug.replace(/-/g, '_'), slug.replace(/-/g, ' ')])];
}

/** Read a `Backlog item:` line — BRIEF §4a's plain form or CULL.md's bold header — from free text. */
export function readPointerLine(text) {
  const m = POINTER_LINE_RE.exec(text);
  return m ? m[1].trim() : null;
}

/**
 * @param {string|null|undefined} raw
 * @returns {{kind:'missing'}|{kind:'invalid', raw:string}|{kind:'none', reason:string}|{kind:'anchor', anchor:string}}
 */
export function parsePointerValue(raw) {
  if (raw === null || raw === undefined) return { kind: 'missing' };
  const value = String(raw).trim();
  if (value === '') return { kind: 'missing' };
  const m = POINTER_VALUE_RE.exec(value);
  if (!m) return { kind: 'invalid', raw: value };
  if (m[1] !== undefined) return { kind: 'none', reason: m[1].trim() };
  return { kind: 'anchor', anchor: m[2] };
}

function isHeadingLine(line) {
  return /^\s*#/.test(line);
}

/**
 * Count non-heading backlog lines whose marker resolves this anchor (promoted or any closed form),
 * and separately record whether a HEADING line matches — a heading marker is elided from GATE I
 * discovery (context_for.mjs:183's CLOSED_HEADING_RE) so it can never be the item's real line.
 */
export function resolveAnchor(backlogText, anchor) {
  const esc = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${ARROW}\\s*(?:promoted|(?:${OUTCOMES.join('|')})\\s+\\d{4}-\\d{2}-\\d{2})\\s*\\(${esc}\\)`);
  let matches = 0;
  let heading = false;
  for (const line of lf(backlogText).split('\n')) {
    if (!re.test(line)) continue;
    if (isHeadingLine(line)) heading = true;
    else matches += 1;
  }
  return { matches, heading };
}

/** Every non-heading line whose marker names this anchor, with its parsed state. */
export function findAnchorLine(backlogText, anchor) {
  const esc = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${ARROW}\\s*(promoted|(${OUTCOMES.join('|')})\\s+(\\d{4}-\\d{2}-\\d{2}))\\s*\\(${esc}\\)`);
  const hits = [];
  lf(backlogText).split('\n').forEach((line, index) => {
    if (isHeadingLine(line)) return;
    const m = re.exec(line);
    if (!m) return;
    hits.push({ index, line, match: m, state: m[2] ? 'closed' : 'promoted', outcome: m[2] || null, date: m[3] || null });
  });
  return hits;
}

// ---- the CLOSURE.md schema --------------------------------------------------------------------

const FIELD_KEYS = Object.freeze([
  'Backlog item', 'Outcome', 'Reason', 'Evidence', 'Terms', 'Doc roots', 'Immutable', 'Follow-ups',
]);

/** @param {string} text @returns {{slug:string|null, fields:Record<string,string>, flags:Array, runs:string[]}} */
export function parseClosureDoc(text) {
  const lines = lf(text).split('\n');
  const doc = { slug: null, fields: {}, flags: [], runs: [] };
  const header = /^#\s*CLOSURE\s*—\s*(.+?)\s*$/.exec(lines[0] || '');
  if (header) doc.slug = header[1];
  let i = 1;
  for (; i < lines.length; i += 1) {
    if (lines[i].trim() === '## Flags') { i += 1; break; }
    const m = /^([A-Za-z][A-Za-z -]*):[ \t]?(.*)$/.exec(lines[i]);
    if (m && FIELD_KEYS.includes(m[1])) doc.fields[m[1]] = m[2].trim();
  }
  for (; i < lines.length; i += 1) {
    if (lines[i].trim() === '## Runs') { i += 1; break; }
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || cells[0] === 'File' || /^-+$/.test(cells[0])) continue;
    doc.flags.push({ file: cells[0], kind: cells[1], hash: cells[2], ruling: cells[3] });
  }
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('- ')) doc.runs.push(line.slice(2));
  }
  for (const key of FIELD_KEYS) if (!Object.hasOwn(doc.fields, key)) doc.fields[key] = '';
  return doc;
}

export function buildClosureDoc(doc) {
  const out = [`# CLOSURE — ${doc.slug}`];
  for (const key of FIELD_KEYS) out.push(`${key}: ${doc.fields[key] ?? ''}`);
  out.push('## Flags');
  out.push('| File | memory/doc | sha256@scan | pending/updated/still-true: <why> |');
  out.push('| --- | --- | --- | --- |');
  for (const row of doc.flags) out.push(`| ${row.file} | ${row.kind} | ${row.hash} | ${row.ruling} |`);
  out.push('## Runs');
  for (const run of doc.runs) out.push(`- ${run}`);
  return `${out.join('\n')}\n`;
}

// ---- the project seam (closure key) -----------------------------------------------------------

/** @param {object} cfg project.json, already read via projectConfig(root) */
export function closureSeam(cfg) {
  const c = cfg && typeof cfg.closure === 'object' && cfg.closure && !Array.isArray(cfg.closure) ? cfg.closure : {};
  const backlogFiles = c.backlog_files && typeof c.backlog_files === 'object' && !Array.isArray(c.backlog_files)
    ? c.backlog_files : {};
  return {
    backlogFiles,
    memoryFiles: Array.isArray(c.memory_files) ? c.memory_files.filter((p) => typeof p === 'string') : [],
    docRoots: Array.isArray(c.doc_roots) ? c.doc_roots.filter((p) => typeof p === 'string') : null,
    immutable: Array.isArray(c.immutable) ? c.immutable.filter((p) => typeof p === 'string') : [],
    // claim-cleanup (T2) additions — I7 extension: holds read from the seam, never named in FW/.
    neverTouch: Array.isArray(c.never_touch) ? c.never_touch.filter((p) => typeof p === 'string') : [],
    defaultBranch: typeof c.default_branch === 'string' && c.default_branch ? c.default_branch : null,
  };
}

/**
 * web-app (the default ascent) falls back to the seam's scaffolded board when unnamed; the kit's
 * other ascent has no fallback and must be named explicitly in the seam. `isChange` (not an ascent
 * name) selects the branch: this file is ascent-neutral by construction — it ships byte-identical
 * to every consumer regardless of which ascents that consumer installed, so its OWN source must
 * never carry a non-default ascent's identity (a web-app-only install must never see it, even
 * inside an error message this file could print). The non-default key is read structurally —
 * "whichever key isn't web-app" — rather than by literal name, for exactly that reason.
 */
export function backlogRelFor(isChange, seam) {
  if (!isChange) {
    return Object.hasOwn(seam.backlogFiles, 'web-app') ? seam.backlogFiles['web-app'] : '.spire/clusters/tech/context/BACKLOG.md';
  }
  const namedKey = Object.keys(seam.backlogFiles).find((k) => k !== 'web-app');
  return namedKey ? seam.backlogFiles[namedKey] : null;
}

const BACKSLASH_RE = /\\/g;
const STATE_SEAM_PREFIX = ['.spire', 'clusters', 'tech'].join('/');

function memoryRelFiles(cfg, seam) {
  const contextFile = Object.hasOwn(cfg, 'context_file') && typeof cfg.context_file === 'string'
    ? cfg.context_file : 'context/PROJECT_CONTEXT.md';
  const defaults = [contextFile, 'context/OPEN_THREADS.md', 'context/DECISION_LEDGER.md', 'context/INDEX.md'].map((rel) => {
    const posix = rel.replace(BACKSLASH_RE, '/');
    return `${STATE_SEAM_PREFIX}/${posix}`;
  });
  return [...new Set([...defaults, ...seam.memoryFiles])];
}

// ---- folder classification (local mirror of contract_lint.mjs's classifyContractFolder) --------
//
// closureDebt/checkClosurePointer live on the contract_lint.mjs side of the fence and already own
// the real classifier — importing it FROM here would be circular, since contract_lint.mjs imports
// THIS file for closureDebt. tests/clusters/tech/tools/closure.test.mjs mechanizes the mirror: it
// runs both classifiers over the same fixture table and asserts they agree, so a change to one
// classifier's family rules that the other misses fails a test, not just a comment.
export function isChangeFolder(folder) {
  const has = (name) => fs.existsSync(path.join(folder, name));
  if (has('CHANGE_SPEC.md')) return true;
  if ((has('CULL.md') || has('HARVEST.md')) && !has('_MANIFEST.md')) return true;
  return false;
}

/** The folder's OWN Backlog item pointer, from BRIEF.md (§4a) or CULL.md (bold header). */
export function readFolderPointer(folder) {
  for (const name of ['BRIEF.md', 'CULL.md']) {
    const p = path.join(folder, name);
    if (!fs.existsSync(p)) continue;
    const raw = readPointerLine(fs.readFileSync(p, 'utf8'));
    if (raw !== null) return { source: name, raw, value: parsePointerValue(raw) };
  }
  return null;
}

// ---- retention (never flagged, counted Immutable) ----------------------------------------------

const DATED_SEGMENT_RE = /\d{4}-\d{2}-\d{2}/;

/** Scan.: "Never flagged, counted Immutable: dated segments, HANDOVER*, contracts/ and state/, the
 *  backlog file, immutable." Mirrors memory_query.mjs:92-94's branch/episodic precedent in spirit. */
export function isRetentionExcluded(relPosix, { backlogRel, immutablePaths = [] } = {}) {
  const segments = relPosix.split('/').filter(Boolean);
  if (segments.some((s) => DATED_SEGMENT_RE.test(s))) return true;
  if (/^HANDOVER/i.test(segments[segments.length - 1] || '')) return true;
  if (relPosix === '.spire/clusters/tech/contracts' || relPosix.startsWith('.spire/clusters/tech/contracts/')) return true;
  if (relPosix === '.spire/clusters/tech/state' || relPosix.startsWith('.spire/clusters/tech/state/')) return true;
  if (relPosix === backlogRel) return true;
  if (immutablePaths.some((p) => relPosix === p || relPosix.startsWith(`${p}/`))) return true;
  return false;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules') continue;
    if (entry.name.startsWith('.') && entry.name !== '.spire') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile()) out.push(abs);
  }
}

/** doc_roots default = whole repository; a seam-narrowed list is the KC-CLOSE-1 limb-A lever. */
function listCandidateDocs(root, docRootsRel) {
  const out = [];
  const bases = docRootsRel && docRootsRel.length ? docRootsRel.map((r) => path.join(root, ...r.split('/'))) : [root];
  for (const base of bases) walk(base, out);
  return out.map((abs) => path.relative(root, abs).split(path.sep).join('/')).filter((rel) => /\.(md|html)$/i.test(rel));
}

/** The fresh scan: memory rows (always flagged) + term-matching docs (flagged unless retention-excluded,
 *  which instead counts toward Immutable). Pure with respect to CLOSURE.md — never reads/writes it. */
export function computeScanFlags(root, folder, cfg) {
  const seam = closureSeam(cfg);
  const slug = path.basename(folder);
  const terms = slugTerms(slug);
  const isChange = isChangeFolder(folder);
  const backlogRel = backlogRelFor(isChange, seam);
  const memoryRels = memoryRelFiles(cfg, seam);

  const rows = [];
  let immutable = 0;
  const seen = new Set();

  for (const rel of memoryRels) {
    const abs = path.join(root, ...rel.split('/'));
    if (!fs.existsSync(abs) || seen.has(rel)) continue;
    seen.add(rel);
    rows.push({ file: rel, kind: 'memory', hash: hashText(fs.readFileSync(abs, 'utf8')) });
  }

  for (const rel of listCandidateDocs(root, seam.docRoots)) {
    if (seen.has(rel)) continue;
    const abs = path.join(root, ...rel.split('/'));
    const text = fs.readFileSync(abs, 'utf8');
    const lower = text.toLowerCase();
    if (!terms.some((t) => lower.includes(t.toLowerCase()))) continue;
    if (isRetentionExcluded(rel, { backlogRel, immutablePaths: seam.immutable })) {
      immutable += 1;
      continue;
    }
    seen.add(rel);
    rows.push({ file: rel, kind: 'doc', hash: hashText(text) });
  }

  return { rows, immutable, backlogRel, terms, seam, isChange };
}

function docRootsField(seam) {
  return seam.docRoots && seam.docRoots.length ? seam.docRoots.join(', ') : 'whole repository';
}

// ---- --scan --------------------------------------------------------------------------------------

/** Creates CLOSURE.md, or appends newly-matched flags as `pending` — NEVER alters an existing row. */
export function runScan(root, folder) {
  const cfg = projectConfig(root);
  const slug = path.basename(folder);
  const closurePath = path.join(folder, 'CLOSURE.md');
  const { rows, immutable, terms, seam } = computeScanFlags(root, folder, cfg);

  let doc;
  if (fs.existsSync(closurePath)) {
    doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
    const existing = new Set(doc.flags.map((r) => r.file));
    for (const row of rows) {
      if (existing.has(row.file)) continue;
      doc.flags.push({ file: row.file, kind: row.kind, hash: row.hash, ruling: 'pending' });
    }
    doc.fields.Immutable = String(immutable);
    doc.fields['Doc roots'] = docRootsField(seam);
  } else {
    const pointer = readFolderPointer(folder);
    const backlogItem = !pointer
      ? 'none (predates closure)'
      : pointer.value.kind === 'anchor' ? pointer.value.anchor
        : pointer.value.kind === 'none' ? `none (${pointer.value.reason})`
          : 'none (predates closure)';
    doc = {
      slug,
      fields: {
        'Backlog item': backlogItem,
        Outcome: '',
        Reason: '',
        Evidence: '',
        Terms: terms.join(', '),
        'Doc roots': docRootsField(seam),
        Immutable: String(immutable),
        'Follow-ups': '0',
      },
      flags: rows.map((row) => ({ file: row.file, kind: row.kind, hash: row.hash, ruling: 'pending' })),
      runs: [],
    };
  }
  fs.writeFileSync(closurePath, buildClosureDoc(doc));
  return { path: closurePath, doc };
}

// ---- refusal predicates (--close pre-write and --check; identical logic, read-only) -------------

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentBranch(root) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return null;
  }
}

/**
 * Every refusal the Hash paragraph names, computed read-only against the folder's current disk
 * state. Empty array ⇒ clear to close. `--check` calls this directly; `--close` calls it pre-write.
 * @returns {{code:string, message:string}[]}
 */
export function computeRefusals(root, folder, opts = {}) {
  const followUps = opts.followUps ?? [];
  const refusals = [];
  const add = (code, message) => refusals.push({ code, message });
  const closurePath = path.join(folder, 'CLOSURE.md');

  if (!fs.existsSync(closurePath)) {
    add('missing-closure', `${closurePath} does not exist — run --scan first`);
    return refusals;
  }

  const cfg = projectConfig(root);
  const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
  const slug = path.basename(folder);
  const isChange = isChangeFolder(folder);
  const seam = closureSeam(cfg);
  const backlogRel = backlogRelFor(isChange, seam);

  const outcome = (doc.fields.Outcome || '').trim();
  const reason = (doc.fields.Reason || '').trim();
  const evidence = (doc.fields.Evidence || '').trim();
  const pointerRaw = doc.fields['Backlog item'];
  const pointer = parsePointerValue(pointerRaw);

  // #10 — a change-classified folder needs its ascent's backlog key NAMED (no default to fall back
  // to — only the default, web-app, ascent has one).
  if (isChange && !backlogRel) {
    add('backlog-key-required', 'this change-classified folder needs its ascent named in closure.backlog_files (no default exists to fall back to)');
  }

  // #1 — required fields.
  if (!outcome || !OUTCOMES.includes(outcome)) add('empty-field', `Outcome must be one of ${OUTCOMES.join('|')} (found "${outcome}")`);
  if (!reason) add('empty-field', 'Reason is blank');
  let evidenceResolved = null;
  if (!evidence) {
    add('missing-evidence', 'Evidence is blank');
  } else {
    evidenceResolved = [path.join(folder, ...evidence.split('/')), path.join(root, ...evidence.split('/'))]
      .find((p) => fs.existsSync(p)) ?? null;
    if (!evidenceResolved) {
      add('missing-evidence', `Evidence "${evidence}" does not resolve to an existing path`);
    } else if (outcome === 'shipped') {
      // A basename match alone is not enough — "some file named VERIFY_REPORT.md exists somewhere
      // reachable" is not "this folder shipped its own report". The resolved path must land on THIS
      // folder's own QA_REPORT.md/VERIFY_REPORT.md, never a same-named file reached via a relative
      // escape (`../other-change/VERIFY_REPORT.md`) or a repo-relative path into a different folder.
      const ownReports = ['QA_REPORT.md', 'VERIFY_REPORT.md'].map((n) => path.resolve(folder, n));
      if (!ownReports.includes(path.resolve(evidenceResolved))) {
        add('shipped-evidence-mismatch', `shipped Evidence must be the folder's own QA_REPORT.md or VERIFY_REPORT.md (found "${evidence}")`);
      }
    }
  }

  // #2 — empty only legal inside a change-classified staging folder.
  if (outcome === 'empty' && !isChange) {
    add('empty-outside-staging', 'Outcome: empty is only legal inside a change-classified staging folder');
  }

  // Blanket backlog-file-must-exist precondition (Write-back: "backlog file must exist" — anchored
  // AND none). Computed once so the anchor branch below never has to re-check existence itself.
  let backlogAbs = null;
  if (backlogRel) {
    const candidate = path.join(root, ...backlogRel.split('/'));
    if (fs.existsSync(candidate)) backlogAbs = candidate;
    else add('backlog-missing', `backlog file ${backlogRel} does not exist`);
  }

  // #4 — pointer: present + resolvable + agrees with BRIEF/CULL.
  if (pointer.kind === 'missing' || pointer.kind === 'invalid') {
    add('pointer-unresolved', `Backlog item is missing or malformed: "${pointerRaw}"`);
  } else {
    const source = readFolderPointer(folder);
    if (source && source.raw.trim() !== String(pointerRaw).trim()) {
      add('pointer-unresolved', `CLOSURE.md Backlog item ("${pointerRaw}") differs from ${source.source} ("${source.raw}")`);
    }
    if (pointer.kind === 'anchor') {
      if (!backlogRel) {
        add('pointer-unresolved', 'no backlog file resolved to check the pointer against');
      } else if (backlogAbs) {
        const backlogText = fs.readFileSync(backlogAbs, 'utf8');
        const { matches, heading } = resolveAnchor(backlogText, pointer.anchor);
        if (matches !== 1 || heading) {
          add('pointer-unresolved',
            `anchor "${pointer.anchor}" resolves to ${matches} line(s)${heading ? ' and a heading match' : ''} in ${backlogRel}`);
        } else {
          // #5 — marker already closed with a DIFFERENT outcome than CLOSURE.md now declares.
          const closedHit = findAnchorLine(backlogText, pointer.anchor).find((h) => h.state === 'closed');
          if (closedHit && closedHit.outcome !== outcome) {
            add('marker-outcome-mismatch',
              `${backlogRel} already closed "${pointer.anchor}" as ${closedHit.outcome}, CLOSURE.md now says "${outcome}"`);
          }
        }
      }
    }
  }

  // #7 — removed default term.
  const declared = (doc.fields.Terms || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (const term of slugTerms(slug)) {
    if (!declared.includes(term.toLowerCase())) add('removed-default-term', `Terms is missing the default form "${term}"`);
  }

  // #6 / #8 — flags: pending, reasonless still-true, updated-on-unchanged-hash, missing rows.
  const { rows: freshRows } = computeScanFlags(root, folder, cfg);
  const freshByFile = new Map(freshRows.map((r) => [r.file, r]));
  const seenFiles = new Set();
  for (const row of doc.flags) {
    seenFiles.add(row.file);
    const ruling = row.ruling || '';
    const stillTrue = /^still-true\s*:?\s*(.*)$/i.exec(ruling);
    if (stillTrue) {
      if (!stillTrue[1].trim()) add('flag-reasonless-still-true', `${row.file} is still-true with no reason`);
      continue;
    }
    if (/^updated\b/i.test(ruling)) {
      const abs = path.join(root, ...row.file.split('/'));
      const currentHash = freshByFile.get(row.file)?.hash
        ?? (fs.existsSync(abs) ? hashText(fs.readFileSync(abs, 'utf8')) : null);
      if (currentHash !== null && currentHash === row.hash) {
        add('flag-updated-unchanged', `${row.file} is ruled updated but its hash is unchanged since scan`);
      }
      continue;
    }
    add('flag-pending', `${row.file} is unruled ("${ruling || 'pending'}")`);
  }
  for (const row of freshRows) {
    if (!seenFiles.has(row.file)) add('flag-missing', `${row.file} matches this close but is missing from Flags — re-run --scan`);
  }

  // #9 — ACTIVE RESUME*.md in the folder, or this branch's IN_FLIGHT row naming a term. Read-only:
  // never marks consumed/superseded, never touches another branch's row or a handover.
  const terms = slugTerms(slug);
  if (fs.existsSync(folder)) {
    for (const entry of fs.readdirSync(folder)) {
      if (!/^RESUME.*\.md$/i.test(entry)) continue;
      const body = fs.readFileSync(path.join(folder, entry), 'utf8');
      const statusMatch = /^\*\*(?:Resume status|Status):?\*\*:?\s*(ACTIVE|CONSUMED)\b/im.exec(body);
      const status = statusMatch ? statusMatch[1].toUpperCase() : 'ACTIVE'; // unmarked defaults ACTIVE
      if (status === 'ACTIVE') add('active-resume', `${entry} in this folder is ACTIVE`);
    }
  }
  const inFlightPath = path.join(root, '.spire', 'clusters', 'tech', 'state', 'IN_FLIGHT.md');
  if (fs.existsSync(inFlightPath)) {
    const branch = currentBranch(root);
    if (branch) {
      for (const line of lf(fs.readFileSync(inFlightPath, 'utf8')).split('\n')) {
        if (!line.trim().startsWith('|')) continue;
        const cells = line.split('|').map((c) => c.trim());
        if (cells[1] !== branch) continue;
        const lower = line.toLowerCase();
        if (terms.some((t) => lower.includes(t.toLowerCase()))) {
          add('active-resume', `IN_FLIGHT.md's ${branch} row names a term of this close`);
        }
      }
    }
  }

  // #11 — Reason, follow-up, or the Last-closed line this close would write must never carry a
  // Spire narrative version (release.mjs:174's pattern — closure prose is not a release surface).
  const candidates = [reason, ...followUps].filter(Boolean);
  if (pointer.kind === 'anchor') candidates.push(`Last closed: ${pointer.anchor} — ${outcome} ${todayISO()}`);
  for (const text of candidates) {
    NARRATIVE_VERSION_RE.lastIndex = 0;
    if (NARRATIVE_VERSION_RE.test(text)) add('narrative-version', `"${text}" names a Spire version near a release identity`);
  }

  return refusals;
}

// ---- --close (write-back) -------------------------------------------------------------------

function upsertIntake(backlogText, anchorOrSlug, texts) {
  if (!texts.length) return { text: backlogText, added: 0 };
  const date = todayISO();
  const block = /## Intake \(unranked\)[\s\S]*$/m.exec(backlogText);
  const existingLines = block ? block[0].split('\n').filter((l) => l.startsWith('- ')) : [];
  const newLines = [];
  for (const t of texts) {
    const line = `- ${t} (from ${anchorOrSlug}, ${date})`;
    if (existingLines.includes(line) || newLines.includes(line)) continue;
    newLines.push(line);
  }
  if (!newLines.length) return { text: backlogText, added: 0 };
  if (block) {
    return {
      text: backlogText.replace(/## Intake \(unranked\)\s*\n/, (m) => `${m}${newLines.join('\n')}\n`),
      added: newLines.length,
    };
  }
  const withTrailingNL = backlogText.endsWith('\n') ? backlogText : `${backlogText}\n`;
  return { text: `${withTrailingNL}## Intake (unranked)\n${newLines.join('\n')}\n`, added: newLines.length };
}

function upsertLastClosed(backlogText, line) {
  if (/^Last closed:.*$/m.test(backlogText)) return backlogText.replace(/^Last closed:.*$/m, line);
  const lines = backlogText.split('\n');
  const headingIndex = lines.findIndex((l) => /^#\s/.test(l));
  lines.splice(headingIndex === -1 ? 0 : headingIndex + 1, 0, line);
  return lines.join('\n');
}

/**
 * Refuses before writing (only a `## Runs` line changes; every other file stays byte-identical), or
 * writes back and self-verifies with the identical --check logic. `none` writes follow-ups only
 * (R7). Same-outcome re-runs are byte-identical: an already-closed marker and its Last-closed line
 * are left untouched, never re-stamped with today's date.
 */
export function runClose(root, folder, opts = {}) {
  const followUps = (opts.followUps ?? []).filter(Boolean);
  const closurePath = path.join(folder, 'CLOSURE.md');
  const refusals = computeRefusals(root, folder, { followUps });
  const nowIso = new Date().toISOString();

  if (refusals.length) {
    if (fs.existsSync(closurePath)) {
      const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
      doc.runs.push(`${nowIso} close REFUSED ${[...new Set(refusals.map((r) => r.code))].join(',')} tool ${toolBlobId()}`);
      fs.writeFileSync(closurePath, buildClosureDoc(doc));
    }
    return { ok: false, refusals };
  }

  const cfg = projectConfig(root);
  const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
  const slug = path.basename(folder);
  const outcome = doc.fields.Outcome.trim();
  const reason = doc.fields.Reason.trim();
  const pointer = parsePointerValue(doc.fields['Backlog item']);
  const seam = closureSeam(cfg);
  const backlogRel = backlogRelFor(isChangeFolder(folder), seam);

  let addedFollowUps = 0;
  if (backlogRel) {
    const backlogAbs = path.join(root, ...backlogRel.split('/'));
    const original = fs.readFileSync(backlogAbs, 'utf8');
    let text = original;

    if (pointer.kind === 'anchor') {
      const hits = findAnchorLine(text, pointer.anchor);
      const promotedHit = hits.find((h) => h.state === 'promoted');
      const alreadyClosed = hits.some((h) => h.state === 'closed');
      if (!alreadyClosed && promotedHit) {
        const date = todayISO();
        const replacement = `${ARROW} ${outcome} ${date} (${pointer.anchor}) — ${reason}; evidence ${slug}/CLOSURE.md`;
        const lines = text.split('\n');
        const line = lines[promotedHit.index];
        lines[promotedHit.index] = line.slice(0, promotedHit.match.index)
          + replacement
          + line.slice(promotedHit.match.index + promotedHit.match[0].length);
        text = lines.join('\n');
        text = upsertLastClosed(text, `Last closed: ${pointer.anchor} — ${outcome} ${date}`);
      }
      // already closed (same outcome, or --check would have refused a differing one): no rewrite —
      // this is the byte-identical-re-run guarantee, marker AND Last-closed line both left alone.
    }

    const anchorOrSlug = pointer.kind === 'anchor' ? pointer.anchor : slug;
    const intake = upsertIntake(text, anchorOrSlug, followUps);
    text = intake.text;
    addedFollowUps = intake.added;

    if (text !== original) fs.writeFileSync(backlogAbs, text);
  }

  doc.fields['Follow-ups'] = String((Number(doc.fields['Follow-ups']) || 0) + addedFollowUps);
  doc.runs.push(`${nowIso} close PASS tool ${toolBlobId()}`);
  fs.writeFileSync(closurePath, buildClosureDoc(doc));

  // Self-verify against the just-written state (Tool.: "--close ... writes back, runs --check").
  const postRefusals = computeRefusals(root, folder);
  const ok = postRefusals.length === 0;
  if (ok) {
    // claim-cleanup (T2), §2: "Only the folder's passing --close also writes it [CLAIMS.md], ruling
    // each claim". Then the sweep runs across this clone (P4: never before this close passed), never
    // altering THIS close's own exit or its CLOSURE.md bytes beyond the Runs line just written above.
    const freshDoc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
    writeClaimRulings(root, folder, freshDoc);
    // C8/§2: "a foreign --root dry-runs" is unscoped — it governs every sweep, not only `closure
    // --clean`. `opts.foreignRoot` is the same CLI-level signal `main` computes for --clean.
    runSweep(root, { foreignRoot: opts.foreignRoot });
  }
  return { ok, refusals: postRefusals };
}

// ---- late skip (closureDebt) ---------------------------------------------------------------------

/**
 * The three ERROR classes contract_lint.mjs folds into lintCanon on every run:
 *   (i) an archived folder with a BRIEF/CULL pointer but no CLOSURE.md;
 *   (ii) a CLOSURE.md whose backlog marker still reads promoted, or reads a different outcome;
 *   (iii) >= 2 live change-classified folders carrying an anchor with no CLOSURE.md.
 * Pre-pointer folders never count; one CLOSURE.md pays. Cheap: no repo-wide doc scan.
 * @returns {string[]}
 */
export function closureDebt(root) {
  const findings = [];
  const contracts = path.join(root, '.spire', 'clusters', 'tech', 'contracts');
  const archive = path.join(contracts, '_archive');
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  const listDirs = (dir) => (isDir(dir) ? fs.readdirSync(dir).sort().filter((n) => isDir(path.join(dir, n))) : []);

  for (const name of listDirs(archive)) {
    const folder = path.join(archive, name);
    if (fs.existsSync(path.join(folder, 'CLOSURE.md'))) continue;
    const pointer = readFolderPointer(folder);
    // Any pointer arms (i) — an anchor AND a `none (<reason>)` both count (CHANGE_SPEC.md Fold:
    // "A armed = anchor ≠ none | Any pointer arms (i)", overruling the architect's anchor-only
    // position). Only a folder with NO pointer LINE at all (pointer === null) is pre-pointer and
    // stays silent — GATE V attempt 2, finding F2.
    if (pointer && (pointer.value.kind === 'anchor' || pointer.value.kind === 'none')) {
      findings.push(`archived '${name}' has a Backlog item pointer but no CLOSURE.md`);
    }
  }

  const cfg = projectConfig(root);
  let liveAnchoredNoClosure = 0;
  for (const name of listDirs(contracts).filter((n) => n !== '_archive')) {
    const folder = path.join(contracts, name);
    const closurePath = path.join(folder, 'CLOSURE.md');
    const pointer = readFolderPointer(folder);
    if (isChangeFolder(folder) && pointer?.value.kind === 'anchor' && !fs.existsSync(closurePath)) {
      liveAnchoredNoClosure += 1;
    }
    if (!fs.existsSync(closurePath)) continue;
    const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
    const docPointer = parsePointerValue(doc.fields['Backlog item']);
    if (docPointer.kind !== 'anchor') continue; // pre-pointer folders never count
    const backlogRel = backlogRelFor(isChangeFolder(folder), closureSeam(cfg));
    if (!backlogRel) continue;
    const backlogAbs = path.join(root, ...backlogRel.split('/'));
    if (!fs.existsSync(backlogAbs)) continue;
    const hits = findAnchorLine(fs.readFileSync(backlogAbs, 'utf8'), docPointer.anchor);
    const closedHit = hits.find((h) => h.state === 'closed');
    const promotedHit = hits.find((h) => h.state === 'promoted');
    const outcome = (doc.fields.Outcome || '').trim();
    if (promotedHit && !closedHit) {
      findings.push(`'${name}': CLOSURE.md reads "${outcome || '(empty)'}" but the backlog marker still reads promoted`);
    } else if (closedHit && closedHit.outcome !== outcome) {
      findings.push(`'${name}': CLOSURE.md reads "${outcome}" but the backlog marker reads "${closedHit.outcome}"`);
    }
  }
  // Also cover archived folders whose marker still disagrees (a folder can be archived and still
  // carry a stale marker if it was archived by hand outside the normal SHIP/park/kill exit).
  for (const name of listDirs(archive)) {
    const folder = path.join(archive, name);
    const closurePath = path.join(folder, 'CLOSURE.md');
    if (!fs.existsSync(closurePath)) continue;
    const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
    const docPointer = parsePointerValue(doc.fields['Backlog item']);
    if (docPointer.kind !== 'anchor') continue;
    const backlogRel = backlogRelFor(isChangeFolder(folder), closureSeam(cfg));
    if (!backlogRel) continue;
    const backlogAbs = path.join(root, ...backlogRel.split('/'));
    if (!fs.existsSync(backlogAbs)) continue;
    const hits = findAnchorLine(fs.readFileSync(backlogAbs, 'utf8'), docPointer.anchor);
    const closedHit = hits.find((h) => h.state === 'closed');
    const promotedHit = hits.find((h) => h.state === 'promoted');
    const outcome = (doc.fields.Outcome || '').trim();
    if (promotedHit && !closedHit) {
      findings.push(`archived '${name}': CLOSURE.md reads "${outcome || '(empty)'}" but the backlog marker still reads promoted`);
    } else if (closedHit && closedHit.outcome !== outcome) {
      findings.push(`archived '${name}': CLOSURE.md reads "${outcome}" but the backlog marker reads "${closedHit.outcome}"`);
    }
  }

  if (liveAnchoredNoClosure >= 2) {
    findings.push(
      `${liveAnchoredNoClosure} live change-classified folders carry a Backlog item pointer with no CLOSURE.md (unrecorded GATE L stop)`,
    );
  }

  return findings;
}

// ---- P1: the source scan — no hard delete, no force, no history rewrite, no untracked network ----
//
// The only removal primitive is moveToTrash; the only two writes reaching outside that boundary are
// a plain worktree removal AFTER its directory is already gone (§2, C2), and a plain branch delete
// after every ancestry check passes. closure.test.mjs feeds this a fixture per banned literal and
// asserts each is caught, then asserts THIS file's own source is clean — red before green, not
// merely green on a tree the guard never had to catch anything on.
// The allowlist necessarily spells out each banned literal, so its OWN two definition lines carry a
// marker and are excluded from the scan below — every other line in this file, comments included, is
// scanned in full.
const SCAN_EXEMPT_MARKER = '// scan-exempt: allowlist data, not usage';
// prettier-ignore
const SOURCE_SCAN_BANS = Object.freeze(['fs.rm(', 'fs.rmSync(', 'rmSync(', '.unlink(', '.rmdir(', "'clean'", "'--force'", "'-D'", "'stash'", "'prune'", "'push'", "'fetch'", 'SPIRE_OS_REGISTRY']); // scan-exempt: allowlist data, not usage
const SOURCE_SCAN_SINGLETONS = Object.freeze(["'remove'", "'ls-remote'"]); // scan-exempt: allowlist data, not usage

/** @param {string} text @returns {string[]} findings; [] ⇒ clean */
export function sourceScanFindings(text) {
  const scanned = lf(text).split('\n').filter((line) => !line.includes(SCAN_EXEMPT_MARKER)).join('\n');
  const findings = [];
  for (const token of SOURCE_SCAN_BANS) {
    if (scanned.includes(token)) findings.push(`banned literal present: ${token}`);
  }
  for (const token of SOURCE_SCAN_SINGLETONS) {
    const count = scanned.split(token).length - 1;
    if (count > 1) findings.push(`${token} appears ${count} times — only its one legitimate use is ever allowed`);
  }
  return findings;
}

// ---- claim-cleanup (T2): --claim, the sweep, --clean --------------------------------------------
//
// A resource the close tool itself creates (a branch, a worktree, a temp scratch folder) is recorded
// the moment it is made, ruled at its own folder's close, and released only once its folder is
// archived and every safety check passes. The only removal primitive is moveToTrash — a source-scan
// test (closure.test.mjs) fails the build the moment a hard-delete or a forced git verb appears
// anywhere in this file, comments included.

function nowUtc() {
  return new Date().toISOString();
}

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/:/g, '-');
}

/** The 12-hex prefix of this file's own git blob id (sha1 of `blob <n>\0<bytes>`), so a Runs line
 *  names the tool that ran it (§4's down-version guard: the window straddles the change). */
export function toolBlobId() {
  try {
    const bytes = fs.readFileSync(fileURLToPath(import.meta.url));
    const header = Buffer.from(`blob ${bytes.length}\0`);
    return crypto.createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex').slice(0, HASH_LEN);
  } catch {
    return '0'.repeat(HASH_LEN);
  }
}

// ---- the path fence (P5): worktrees and temp folders live only here ------------------------------

const WORKTREES_REL = '.worktrees';
const TMP_REL = '.spire/tmp';

function claimTargetPath(root, kind, id) {
  if (kind === 'worktree') return path.join(root, WORKTREES_REL, id);
  if (kind === 'temp') return path.join(root, ...TMP_REL.split('/'), id);
  return null; // branch has no filesystem path
}

function safeRealpath(abs) {
  try {
    return fs.realpathSync(abs);
  } catch {
    let dir = path.dirname(abs);
    while (dir !== path.dirname(dir) && !fs.existsSync(dir)) dir = path.dirname(dir);
    const dirReal = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
    return path.join(dirReal, path.relative(dir, abs));
  }
}

/** Realpath containment inside the fence roots, symlink-escape safe: a claim target (existing or not
 *  yet created) must resolve under `.worktrees/` or `.spire/tmp/`, nothing above or beside it. */
export function withinFence(root, abs) {
  const rootReal = fs.realpathSync(root);
  const rel = path.relative(rootReal, safeRealpath(abs)).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return rel === WORKTREES_REL || rel.startsWith(`${WORKTREES_REL}/`) || rel === TMP_REL || rel.startsWith(`${TMP_REL}/`);
}

function gitCommonDirAbs(root) {
  const r = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? path.resolve(root, r.stdout.trim()) : root;
}

/** A hash of this clone's git-common-dir: a `claimed` row from another clone is skipped by the sweep
 *  (R1 §2.5) — two clones of the same repository must never retire each other's claims. */
export function cloneId(root) {
  return hashText(gitCommonDirAbs(root)).slice(0, 8);
}

// ---- CLAIMS.md: append-only; --claim writes `claimed`, the folder's own passing --close rules it --

export const CLAIM_KINDS = Object.freeze(['temp', 'worktree', 'branch']);

/** @param {string} text @returns {{utc:string,kind:string,id:string,act:string,detail:string}[]} */
export function parseClaimsDoc(text) {
  const rows = [];
  for (const line of lf(text).split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5 || cells[0] === 'UTC' || /^-+$/.test(cells[0])) continue;
    rows.push({ utc: cells[0], kind: cells[1], id: cells[2], act: cells[3], detail: cells[4] });
  }
  return rows;
}

export function buildClaimsDoc(slug, rows) {
  const out = [`# CLAIMS — ${slug}`, '', '| UTC | kind | id | act | detail |', '| --- | --- | --- | --- | --- |'];
  for (const row of rows) out.push(`| ${row.utc} | ${row.kind} | ${row.id} | ${row.act} | ${row.detail} |`);
  return `${out.join('\n')}\n`;
}

function appendClaimsRows(folder, newRows) {
  const slug = path.basename(folder);
  const claimsPath = path.join(folder, 'CLAIMS.md');
  const rows = fs.existsSync(claimsPath) ? parseClaimsDoc(fs.readFileSync(claimsPath, 'utf8')) : [];
  const merged = [...rows, ...newRows];
  fs.writeFileSync(claimsPath, buildClaimsDoc(slug, merged));
  return merged;
}

// ---- never-touch (I9, strengthened): the union of HEAD and the working tree, every sweep ----------

function readUnion(root, relPosix) {
  const texts = [];
  const abs = path.join(root, ...relPosix.split('/'));
  if (fs.existsSync(abs)) {
    try { texts.push(fs.readFileSync(abs, 'utf8')); } catch { /* unreadable in this state — skip it */ }
  }
  const r = spawnSync('git', ['show', `HEAD:${relPosix}`], { cwd: root, encoding: 'utf8' });
  if (r.status === 0 && typeof r.stdout === 'string' && !texts.includes(r.stdout)) texts.push(r.stdout);
  return texts;
}

function pathHoldsAgainst(candidateRel, namedRel) {
  const a = candidateRel.replace(/\\/g, '/').replace(/\/+$/, '');
  const b = namedRel.replace(/\\/g, '/').replace(/\/+$/, '');
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

const KILL_HEADING_RE = /^##\s*Armed kill conditions/i;

/** Rows of the backlog's "Armed kill conditions" table, each `{ id, text }` (every cell joined). */
export function parseArmedKillRows(backlogText) {
  const lines = lf(backlogText).split('\n');
  const start = lines.findIndex((l) => KILL_HEADING_RE.test(l));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    const idMatch = /\*\*([A-Z][A-Z0-9-]*)\*\*/.exec(cells[0]);
    if (!idMatch) continue; // the header row or its "| --- |" separator
    rows.push({ id: idMatch[1], text: cells.join(' ‖ ') });
  }
  return rows;
}

const CITED_FOLDER_RE = new RegExp(`(?:contracts/)?_archive/(${ANCHOR_SOURCE})/|contracts/(${ANCHOR_SOURCE})/`, 'g');

/** Folder slugs a kill row's text cites — `contracts/_archive/<slug>/`, bare `_archive/<slug>/`, or a
 *  live `contracts/<slug>/`. A bare `<slug>` word with no path structure around it cites nothing. */
export function citedFolderSlugs(rowText) {
  const slugs = new Set();
  CITED_FOLDER_RE.lastIndex = 0;
  let m;
  while ((m = CITED_FOLDER_RE.exec(rowText))) slugs.add(m[1] || m[2]);
  return slugs;
}

const CITED_FILENAME_RE = /\b([A-Za-z][A-Za-z0-9_.-]*\.md)\b/g;

/** `.md` filenames a row's text names — never CLAIMS.md or a CLEAN-*.md name (C10's exclusion). */
function citedFilenames(rowText) {
  const names = new Set();
  CITED_FILENAME_RE.lastIndex = 0;
  let m;
  while ((m = CITED_FILENAME_RE.exec(rowText))) {
    if (/^CLAIMS\.md$/i.test(m[1]) || /^CLEAN-.*\.md$/i.test(m[1])) continue;
    names.add(m[1]);
  }
  return names;
}

// N2: a bare filename cited alongside a `contracts/<slug>/` path is read from INSIDE that folder
// (above), but §2/C10 says "each id the row OR A FILE IT CITES names" without confining that file to
// a contracts/ folder — a row can cite a full repo-relative path outside contracts/ entirely, a
// research note several directories deep, say. This regex captures any such multi-segment `.md`
// path, read independent of any folder citation, so a kill row that only ever names a repo-relative
// file still gets read. (Deliberately no literal multi-segment example here: compose's installed-
// reference checker treats any `word/word.md`-shaped token in an installed framework file's own text
// as a path it must resolve, so an illustrative-only example would itself misfire that unrelated
// gate.)
const CITED_REPO_PATH_RE = /\b((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.md)\b/g;

/** Full repo-relative, multi-segment `.md` paths a row's text names — same CLAIMS.md/CLEAN-*.md
 *  exclusion as citedFilenames, applied to the path's own basename. */
function citedRepoPaths(rowText) {
  const paths = new Set();
  CITED_REPO_PATH_RE.lastIndex = 0;
  let m;
  while ((m = CITED_REPO_PATH_RE.exec(rowText))) {
    const base = m[1].split('/').pop();
    if (/^CLAIMS\.md$/i.test(base) || /^CLEAN-.*\.md$/i.test(base)) continue;
    paths.add(m[1]);
  }
  return paths;
}

/**
 * C10's settlement: a cited folder's TEMP claims hold whole (every id, even unnamed); its worktree
 * and branch claims hold only an id the row itself, or a file it cites, literally names.
 * @param {{folderSlug:string, kind:string, id:string}[]} claimsUniverse every claim this sweep sees
 * @returns {Map<string,string>} claim id -> the kill row id that holds it
 */
export function killHoldsFor(root, backlogRelPosix, claimsUniverse) {
  const holds = new Map();
  if (!backlogRelPosix) return holds;
  for (const backlogText of readUnion(root, backlogRelPosix)) {
    for (const row of parseArmedKillRows(backlogText)) {
      const folders = citedFolderSlugs(row.text);
      for (const slug of folders) {
        for (const claim of claimsUniverse) {
          if (claim.folderSlug === slug && claim.kind === 'temp' && !holds.has(claim.id)) holds.set(claim.id, row.id);
        }
      }
      const filenames = citedFilenames(row.text);
      const namedTexts = [row.text];
      for (const slug of folders) {
        for (const filename of filenames) {
          for (const contractsRel of [
            `.spire/clusters/tech/contracts/${slug}/${filename}`,
            `.spire/clusters/tech/contracts/_archive/${slug}/${filename}`,
          ]) {
            namedTexts.push(...readUnion(root, contractsRel));
          }
        }
      }
      // N2: a file cited by a full repo-relative path is read regardless of folder citation.
      for (const relPath of citedRepoPaths(row.text)) {
        namedTexts.push(...readUnion(root, relPath));
      }
      for (const claim of claimsUniverse) {
        if (holds.has(claim.id)) continue;
        if (namedTexts.some((t) => t.includes(claim.id))) holds.set(claim.id, row.id);
      }
    }
  }
  return holds;
}

// continuity.mjs is loaded LAZILY, only here — the one place in this file that needs it (the
// never-touch check, consulted at claim time, at the folder's own close-time ruling, and by the real
// sweep). closure.mjs is installed into every consumer and must stay loadable wherever it sits with
// only `_project.mjs` beside it (release.mjs's GATE R bootstrap preflight and contract_lint.mjs's
// test fixture both seed exactly that pair); a static top-level `import` of continuity.mjs made the
// whole module unloadable without it, reddening both (T2 repair round 1). `createRequire` gives a
// SYNCHRONOUS load of the ESM module — Node 22.12+ supports synchronous `require()` of an ES module
// whose graph has no top-level await (continuity.mjs has none) — so every caller of baseNeverTouch
// stays synchronous rather than needing to become async, which would ripple through
// runClaim/writeClaimRulings/runSweep and every CLI/test caller for the sake of one lazy import.
let _listContinuity; // undefined = not yet attempted; null = load failed; function = loaded
function loadListContinuity() {
  if (_listContinuity !== undefined) return _listContinuity;
  try {
    const req = createRequire(import.meta.url);
    _listContinuity = req('./continuity.mjs').listContinuity;
  } catch {
    _listContinuity = null; // continuity.mjs missing/unloadable beside this copy of closure.mjs
  }
  return _listContinuity;
}

/** The seam key, LIVE handover / ACTIVE RESUME, and other branches' IN_FLIGHT rows — I9's first
 *  three sources, re-read fresh every sweep from the union of HEAD and the working tree (E4).
 *  Fail SAFE: when continuity.mjs cannot be loaded or thrown, the LIVE-handover/ACTIVE-RESUME source
 *  is unknown, so `continuityUnavailable` is set and neverTouchSourceFor holds EVERY candidate with
 *  `never-touch:continuity-unavailable` — the check is never silently skipped. */
export function baseNeverTouch(root, seam) {
  const paths = [...seam.neverTouch];
  let continuityItems = [];
  let continuityUnavailable = false;
  const listContinuity = loadListContinuity();
  if (!listContinuity) {
    continuityUnavailable = true;
  } else {
    try { continuityItems = listContinuity(root); } catch { continuityUnavailable = true; }
  }
  for (const item of continuityItems) {
    const held = (item.kind === 'handover' && item.status === 'LIVE') || (item.kind === 'resume' && item.status === 'ACTIVE');
    if (held) paths.push(item.path);
  }
  const branches = new Set();
  const branch = currentBranch(root);
  for (const text of readUnion(root, '.spire/clusters/tech/state/IN_FLIGHT.md')) {
    for (const line of lf(text).split('\n')) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line.split('|').map((c) => c.trim());
      const rowBranch = cells[1];
      if (!rowBranch || rowBranch === 'Branch' || /^-+$/.test(rowBranch) || rowBranch === branch) continue;
      branches.add(rowBranch);
    }
  }
  return { paths, branches: [...branches], continuityUnavailable };
}

/**
 * @param {{paths:string[], branches:string[], killHolds:Map<string,string>, continuityUnavailable?:boolean}} neverTouch
 * @param {{kind:string, id:string, relPath?:string|null}} claim
 * @returns {string|null} the hold source (without the `never-touch:` prefix), or null when clear
 */
export function neverTouchSourceFor(neverTouch, claim) {
  // Fail safe: continuity.mjs couldn't be loaded/read, so the LIVE-handover/ACTIVE-RESUME source is
  // unknown — every candidate holds rather than the check silently skipping that source.
  if (neverTouch.continuityUnavailable) return 'continuity-unavailable';
  if (claim.kind === 'branch' && neverTouch.branches.includes(claim.id)) return `in-flight:${claim.id}`;
  if (claim.kind === 'branch') {
    // the seam's list carries both paths (worktree/temp) and branch names; a branch is held when its
    // literal name is a seam entry.
    if (neverTouch.paths.includes(claim.id)) return `seam:${claim.id}`;
  } else if (claim.relPath) {
    for (const p of neverTouch.paths) {
      if (pathHoldsAgainst(claim.relPath, p)) return `path:${p}`;
    }
  }
  if (neverTouch.killHolds.has(claim.id)) return `kill:${neverTouch.killHolds.get(claim.id)}`;
  return null;
}

function claimRelPath(root, claim) {
  return claim.kind === 'branch' ? null
    : path.relative(root, claimTargetPath(root, claim.kind, claim.id)).split(path.sep).join('/');
}

// ---- Trash: the sole removal primitive, darwin only, injectable for tests -----------------------

/**
 * darwin: a rename into `<home>/.Trash/<name> <UTC>`, landed iff the destination exists afterward
 * and the source is gone — a rename either fully lands or throws, so this is belt-and-braces, never
 * a copy-then-delete. EXDEV/EPERM and every other host hold. `platform`/`home` are injectable so the
 * suite never touches the operator's real Trash; the one real trial is the warden's, at GATE V.
 * @returns {{landed:boolean, dest?:string, code?:string}}
 */
export function moveToTrash(abs, { home = os.homedir(), platform = process.platform } = {}) {
  if (platform !== 'darwin') return { landed: false, code: platform };
  const dest = path.join(home, '.Trash', `${path.basename(abs)} ${utcStamp()}`);
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(abs, dest);
  } catch (err) {
    return { landed: false, code: err.code || 'unknown' };
  }
  const landed = fs.existsSync(dest) && !fs.existsSync(abs);
  return landed ? { landed: true, dest } : { landed: false, code: 'unverified', dest };
}

// ---- --claim: creates the resource, appends one `claimed` row ------------------------------------

function currentDefaultBranch(root, seam) {
  if (seam.defaultBranch) return seam.defaultBranch;
  const symref = spawnSync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { cwd: root, encoding: 'utf8' });
  if (symref.status === 0 && symref.stdout.trim()) return symref.stdout.trim().replace(/^origin\//, '');
  return currentBranch(root);
}

/**
 * @param {string} kind one of CLAIM_KINDS
 * @param {{id:string, base?:string, branch?:string}} opts
 * @returns {{ok:boolean, id?:string, target?:string, reason?:string}}
 */
export function runClaim(root, folder, kind, opts = {}) {
  if (!CLAIM_KINDS.includes(kind)) return { ok: false, reason: `unknown claim kind "${kind}" (must be ${CLAIM_KINDS.join('|')})` };
  const id = opts.id;
  if (!id) return { ok: false, reason: `--claim ${kind} needs a name` };
  if (kind !== 'temp' && !opts.base) return { ok: false, reason: `--claim ${kind} needs --base <ref>` };

  const slug = path.basename(folder);
  const closurePath = path.join(folder, 'CLOSURE.md');
  if (fs.existsSync(closurePath)) {
    const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
    if (doc.runs.some((r) => / close PASS(\s|$)/.test(r))) return { ok: false, reason: `${slug} is already closed` };
  }

  const targetAbs = claimTargetPath(root, kind, id);
  if (targetAbs) {
    if (!withinFence(root, targetAbs)) return { ok: false, reason: `${targetAbs} sits outside the fence` };
    if (fs.existsSync(targetAbs)) return { ok: false, reason: `${targetAbs} already exists` };
  } else {
    const exists = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${id}`], { cwd: root, stdio: 'ignore' }).status === 0;
    if (exists) return { ok: false, reason: `branch "${id}" already exists` };
  }

  const seam = closureSeam(projectConfig(root));
  const neverTouch = { ...baseNeverTouch(root, seam), killHolds: new Map() };
  const relPath = targetAbs ? path.relative(root, targetAbs).split(path.sep).join('/') : null;
  const heldSource = neverTouchSourceFor(neverTouch, { kind, id, relPath });
  if (heldSource) return { ok: false, reason: `never-touch:${heldSource}` };

  try {
    if (kind === 'temp') {
      fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
      fs.mkdirSync(targetAbs);
    } else if (kind === 'worktree') {
      fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
      const args = ['worktree', 'add'];
      if (opts.branch) args.push('-b', opts.branch);
      args.push(targetAbs, opts.base);
      execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    } else {
      execFileSync('git', ['branch', id, opts.base], { cwd: root, stdio: 'ignore' });
    }
  } catch (err) {
    return { ok: false, reason: `create failed: ${err.message}` };
  }

  const baseSha = kind === 'temp' ? null : execFileSync('git', ['rev-parse', opts.base], { cwd: root }).toString().trim();
  const detail = kind === 'temp' ? `clone ${cloneId(root)}` : `base ${baseSha}; clone ${cloneId(root)}`;
  fs.mkdirSync(folder, { recursive: true });
  appendClaimsRows(folder, [{ utc: nowUtc(), kind, id, act: 'claimed', detail }]);
  return { ok: true, id, target: targetAbs };
}

// ---- claim rulings written at the folder's OWN passing --close (pre-archive) ---------------------

function writeClaimRulings(root, folder, doc) {
  const claimsPath = path.join(folder, 'CLAIMS.md');
  if (!fs.existsSync(claimsPath)) return;
  const rows = parseClaimsDoc(fs.readFileSync(claimsPath, 'utf8'));
  const seenCount = new Map();
  for (const row of rows) seenCount.set(row.id, (seenCount.get(row.id) || 0) + 1);
  const unruled = rows.filter((r) => r.act === 'claimed' && seenCount.get(r.id) === 1);
  if (!unruled.length) return;

  const outcome = (doc.fields.Outcome || '').trim();
  const slug = path.basename(folder);
  const seam = closureSeam(projectConfig(root));
  const claimsUniverse = unruled.map((r) => ({ folderSlug: slug, kind: r.kind, id: r.id }));
  const backlogRel = backlogRelFor(isChangeFolder(folder), seam);
  const killHolds = killHoldsFor(root, backlogRel, claimsUniverse);
  const neverTouch = { ...baseNeverTouch(root, seam), killHolds };

  const additions = unruled.map((row) => {
    let ruling;
    if (outcome === 'parked') {
      ruling = 'kept: parked';
    } else {
      const source = neverTouchSourceFor(neverTouch, { kind: row.kind, id: row.id, relPath: claimRelPath(root, row) });
      ruling = source ? `never-touch:${source}` : 'pending: archive';
    }
    return { utc: nowUtc(), kind: row.kind, id: row.id, act: ruling, detail: '' };
  });
  appendClaimsRows(folder, additions);
}

// ---- the sweep: real removal, only for already-archived, eligible folders ------------------------

function isSweepEligible(folder) {
  const closurePath = path.join(folder, 'CLOSURE.md');
  if (!fs.existsSync(closurePath)) return false;
  const doc = parseClosureDoc(fs.readFileSync(closurePath, 'utf8'));
  const lastRun = doc.runs.length ? doc.runs[doc.runs.length - 1] : '';
  if (!/ close PASS(\s|$)/.test(lastRun)) return false;
  const outcome = (doc.fields.Outcome || '').trim();
  return outcome === 'shipped' || outcome === 'killed' || outcome === 'empty';
}

function parseCleanDoc(text) {
  const removals = [];
  for (const line of lf(text).split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || cells[0] === 'act' || /^-+$/.test(cells[0])) continue;
    removals.push({ act: cells[0], id: cells[1], kind: cells[2], detail: cells[3] });
  }
  return { removals, hasAfter: /^##\s*After/m.test(text) };
}

function releasedIdsFor(folder) {
  const released = new Set();
  if (!fs.existsSync(folder)) return released;
  for (const name of fs.readdirSync(folder)) {
    if (!/^CLEAN-.*\.md$/i.test(name)) continue;
    const doc = parseCleanDoc(fs.readFileSync(path.join(folder, name), 'utf8'));
    for (const r of doc.removals) released.add(r.id);
  }
  return released;
}

function stagedCleanPath(folder) {
  return path.join(folder, `CLEAN-${utcStamp()}.md`);
}

function buildCleanDoc(doc) {
  const out = [`# CLEAN — ${doc.slug}`, ''];
  out.push('## Before', '```json', JSON.stringify(doc.before, null, 2), '```', '');
  out.push('## Removals', '| act | id | kind | detail |', '| --- | --- | --- | --- |');
  for (const r of doc.removals) {
    if (r.act === 'trashed') {
      out.push(`| trashed | ${r.id} | ${r.kind} | digest=${r.digest} files=${r.files} bytes=${r.bytes} dest=${r.dest} cited-by=${(r.citedBy && r.citedBy.length) ? r.citedBy.join(';') : 'none'} |`);
    } else {
      out.push(`| deleted | ${r.id} | ${r.kind} | sha=${r.sha} |`);
    }
  }
  out.push('');
  if (doc.after) out.push('## After', '```json', JSON.stringify(doc.after, null, 2), '```', '');
  return `${out.join('\n')}\n`;
}

function safeGit(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function buildInventory(root, claims, neverTouch) {
  const head = safeGit(root, ['rev-parse', 'HEAD']);
  const heads = (safeGit(root, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads']) || '')
    .split('\n').filter(Boolean);
  const worktrees = safeGit(root, ['worktree', 'list', '--porcelain']) || '';
  const fenceEntries = [];
  for (const rel of [WORKTREES_REL, TMP_REL]) {
    const abs = path.join(root, ...rel.split('/'));
    if (fs.existsSync(abs)) fenceEntries.push(...fs.readdirSync(abs).map((n) => `${rel}/${n}`));
  }
  const neverTouchIds = [];
  for (const claim of claims) {
    const source = neverTouchSourceFor(neverTouch, { kind: claim.kind, id: claim.id, relPath: claimRelPath(root, claim) });
    if (source) neverTouchIds.push({ id: claim.id, src: source });
  }
  return { head, heads, worktrees, fenceEntries, neverTouchIds };
}

function digestDir(abs) {
  const files = [];
  (function walkAll(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walkAll(p);
      else if (entry.isFile()) files.push(p);
    }
  }(abs));
  files.sort();
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f);
    bytes += buf.length;
    hash.update(path.relative(abs, f));
    hash.update(buf);
  }
  return { digest: hash.digest('hex').slice(0, HASH_LEN), files: files.length, bytes };
}

/** Every tracked file in `folder` (never CLAIMS.md/CLEAN-*.md) that names `claim.id` — P3's tombstone
 *  `cited-by`, each entry a citing `path:line`. */
function citedByFor(root, folder, claim) {
  const cites = [];
  const listed = spawnSync('git', ['-C', folder, 'ls-files'], { encoding: 'utf8' });
  const names = listed.status === 0 ? listed.stdout.split('\n').filter(Boolean) : [];
  for (const name of names) {
    if (name === 'CLAIMS.md' || /^CLEAN-.*\.md$/i.test(name)) continue;
    const abs = path.join(folder, name);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    lf(text).split('\n').forEach((line, i) => {
      if (line.includes(claim.id)) cites.push(`${name}:${i + 1}`);
    });
  }
  return cites;
}

export function isAncestor(root, sha, ref) {
  if (!sha || !ref) return null;
  const r = spawnSync('git', ['merge-base', '--is-ancestor', sha, ref], { cwd: root, stdio: 'ignore' });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  return null; // 128 (unknown commit, e.g. an unfetched remote SHA) or a spawn failure — hold
}

function remoteDefaultSha(root) {
  const r = spawnSync('git', ['ls-remote', '--symref', 'origin', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0 || r.error) return null;
  const m = /^([0-9a-f]{40})\tHEAD$/m.exec(r.stdout || '');
  return m ? m[1] : null;
}

/** A worktree path as git spells it: the OS-canonical form of its parent (symlinks and, on Windows,
 *  8.3 short names resolved) plus the literal leaf, so a leaf that is itself a symlink still names
 *  only its own entry. Both sides of the `git worktree list` match go through this: a root reached
 *  through an alias spelled every claim differently from git's record, and each one held
 *  entry-stale (Windows CI, 2026-09-24: the runner's temp dir is C:\Users\RUNNER~1\...). */
function worktreeKey(p) {
  const resolved = path.resolve(p);
  let dir = path.dirname(resolved);
  const tail = [path.basename(resolved)];
  while (!fs.existsSync(dir) && dir !== path.dirname(dir)) {
    tail.unshift(path.basename(dir));
    dir = path.dirname(dir);
  }
  let key;
  try { key = path.join(fs.realpathSync.native(dir), ...tail); } catch { key = resolved; }
  return process.platform === 'win32' ? key.toLowerCase() : key;
}

/** The one `git worktree list` record for `targetAbs`, or null (the caller holds entry-stale). Two
 *  records that key to one directory are ambiguous, never first-match: whichever git lists first
 *  would supply HEAD and the lock bit for a tree that may be neither (governor stakes read, close
 *  sweep cycle 4 — a merged shadow record got an unmerged tree trashed). */
function worktreeInfo(root, targetAbs) {
  const r = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const want = worktreeKey(targetAbs);
  const matches = [];
  for (const block of r.stdout.split('\n\n')) {
    const lines = block.split('\n').filter(Boolean);
    const wtLine = lines.find((l) => l.startsWith('worktree '));
    if (!wtLine) continue;
    if (worktreeKey(wtLine.slice('worktree '.length)) !== want) continue;
    matches.push({
      head: (lines.find((l) => l.startsWith('HEAD ')) || '').slice(5).trim(),
      locked: lines.some((l) => l === 'locked' || l.startsWith('locked ')),
    });
  }
  return matches.length === 1 ? matches[0] : null;
}

function branchCheckedOutElsewhere(root, id) {
  const r = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.includes(`branch refs/heads/${id}\n`);
}

/** One claim, fully evaluated: a hold reason, a would-be plan (dry-run), or a completed removal. */
function attemptRemoval(root, folder, claim, ctx) {
  const ntSource = neverTouchSourceFor(ctx.neverTouch, { kind: claim.kind, id: claim.id, relPath: claimRelPath(root, claim) });
  if (ntSource) return { hold: `never-touch:${ntSource}` };

  if (claim.kind === 'temp') {
    const abs = claimTargetPath(root, 'temp', claim.id);
    if (!fs.existsSync(abs)) return { hold: 'refused: entry-stale' };
    if (!withinFence(root, abs)) return { hold: 'refused: outside-fence' };
    const tracked = spawnSync('git', ['ls-files', '--', abs], { cwd: root, encoding: 'utf8' });
    if (tracked.status !== 0) return { hold: 'refused: entry-stale' };
    if (tracked.stdout.trim()) return { hold: 'refused: tracked-content' };
    const measured = digestDir(abs);
    if (ctx.dryRun) return { wouldTrash: { abs, ...measured } };
    const result = moveToTrash(abs, { home: ctx.home, platform: ctx.platform });
    if (!result.landed) return { hold: `refused: trash-unavailable:${result.code}` };
    return { trashed: { id: claim.id, kind: claim.kind, ...measured, dest: result.dest } };
  }

  if (claim.kind === 'worktree') {
    const abs = claimTargetPath(root, 'worktree', claim.id);
    const info = worktreeInfo(root, abs);
    if (!info) return { hold: 'refused: entry-stale' };
    if (info.locked) return { hold: 'refused: locked' };
    if (!withinFence(root, abs)) return { hold: 'refused: outside-fence' };
    // P5: "nothing tracked at or under" — the ROOT's own index, not the worktree's own history. A
    // worktree directory carries a `.git` FILE, so `git add -A` from the root sees it as a gitlink
    // (mode 160000) and tracks it as a single entry AT that path — `ls-files` surfaces exactly that.
    const tracked = spawnSync('git', ['ls-files', '--', abs], { cwd: root, encoding: 'utf8' });
    if (tracked.status !== 0) return { hold: 'refused: entry-stale' };
    if (tracked.stdout.trim()) return { hold: 'refused: tracked-content' };
    const status = spawnSync('git', ['-C', abs, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
    if (status.status !== 0 || status.stdout.trim()) return { hold: 'refused: dirty' };
    if (isAncestor(root, info.head, ctx.defaultBranchName) !== true) return { hold: 'refused: unmerged' };
    const measured = digestDir(abs);
    if (ctx.dryRun) return { wouldTrash: { abs, ...measured } };
    const result = moveToTrash(abs, { home: ctx.home, platform: ctx.platform });
    if (!result.landed) return { hold: `refused: trash-unavailable:${result.code}` };
    spawnSync('git', ['worktree', 'remove', abs], { cwd: root, encoding: 'utf8' }); // dir is gone; plain remove cleans the admin dir (GATE_L C2)
    return { trashed: { id: claim.id, kind: claim.kind, ...measured, dest: result.dest } };
  }

  // branch
  const localExists = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${claim.id}`], { cwd: root, stdio: 'ignore' }).status === 0;
  if (!localExists) return { hold: 'refused: entry-stale' };
  const current = currentBranch(root);
  if (claim.id === current || claim.id === ctx.defaultBranchName || branchCheckedOutElsewhere(root, claim.id)) {
    return { hold: 'refused: checked-out' };
  }
  const sha = execFileSync('git', ['rev-parse', claim.id], { cwd: root }).toString().trim();
  if (isAncestor(root, sha, ctx.defaultBranchName) !== true) return { hold: 'refused: unmerged' };
  const remoteSha = remoteDefaultSha(root);
  if (!remoteSha) return { hold: 'pending: remote-unverified' };
  if (isAncestor(root, sha, remoteSha) !== true) return { hold: 'refused: unmerged' };
  if (ctx.dryRun) return { wouldDelete: { sha } };
  // The ancestry checks above are necessary but not sufficient: `git branch -d` also checks the
  // branch's OWN upstream tracking ref, which can be stale even when the tip is a genuine ancestor
  // of both defaults (GATE_L erratum, reproduced on git 2.55.0 — a pushed-with-upstream branch
  // extended locally afterward). Only a 0 exit writes `deleted`; anything else holds `unmerged`.
  const del = spawnSync('git', ['branch', '-d', claim.id], { cwd: root, encoding: 'utf8' });
  if (del.status !== 0) return { hold: 'refused: unmerged' };
  return { deleted: { id: claim.id, kind: claim.kind, sha } };
}

/**
 * @param {{dryRun?:boolean, home?:string, platform?:string}} [opts]
 * @returns {{folders: Array}}
 */
export function runSweep(root, opts = {}) {
  const dryRun = !!opts.dryRun;
  const cfg = projectConfig(root);
  const seam = closureSeam(cfg);
  const defaultBranchName = currentDefaultBranch(root, seam);
  const archiveDir = path.join(root, '.spire', 'clusters', 'tech', 'contracts', '_archive');
  const report = { folders: [] };
  if (!fs.existsSync(archiveDir)) return report;

  const folderNames = fs.readdirSync(archiveDir)
    .filter((n) => { try { return fs.statSync(path.join(archiveDir, n)).isDirectory(); } catch { return false; } })
    .sort();

  const myClone = cloneId(root);
  const perFolder = new Map();
  const universe = [];
  for (const name of folderNames) {
    const folder = path.join(archiveDir, name);
    if (!isSweepEligible(folder)) continue;
    // "this clone's unreleased claimed rows (git show HEAD:)" — only a COMMITTED CLAIMS.md is ever
    // acted on, never an uncommitted straggler in the working tree (P6: listings verify, never discover).
    const claimsRel = path
      .relative(root, path.join(folder, 'CLAIMS.md'))
      .split(path.sep)
      .join('/');
    const claimsText = safeGit(root, ['show', `HEAD:${claimsRel}`]);
    if (claimsText === null) continue;
    const rows = parseClaimsDoc(claimsText);
    const claimedRows = rows.filter((r) => r.act === 'claimed' && r.detail.includes(`clone ${myClone}`));
    const released = releasedIdsFor(folder);
    const pending = claimedRows.filter((r) => !released.has(r.id));
    if (!pending.length) continue;
    perFolder.set(name, { folder, claims: pending });
    for (const r of pending) universe.push({ folderSlug: name, kind: r.kind, id: r.id });
  }

  const backlogRel = backlogRelFor(true, seam) || backlogRelFor(false, seam);
  const killHolds = killHoldsFor(root, backlogRel, universe);
  const neverTouch = { ...baseNeverTouch(root, seam), killHolds };

  for (const [name, { folder, claims }] of perFolder) {
    const entry = { folder: name, results: [] };
    const ordered = [...claims].sort((a, b) => (a.kind === 'worktree' ? 0 : 1) - (b.kind === 'worktree' ? 0 : 1));
    const ctx = { neverTouch, defaultBranchName, home: opts.home, platform: opts.platform, dryRun: dryRun || opts.foreignRoot };

    if (dryRun || opts.foreignRoot) {
      for (const claim of ordered) entry.results.push({ id: claim.id, kind: claim.kind, ...attemptRemoval(root, folder, claim, ctx) });
      report.folders.push(entry);
      continue;
    }

    const cleanPath = stagedCleanPath(folder);
    if (fs.existsSync(cleanPath)) {
      entry.refused = `${path.basename(cleanPath)} already exists`;
      report.folders.push(entry);
      continue;
    }
    const doc = { slug: name, before: buildInventory(root, ordered, neverTouch), removals: [] };
    try {
      fs.writeFileSync(cleanPath, buildCleanDoc(doc)); // stage: before-inventory first, exclusively.
      // §2/C7: "a staged, exclusive CLEAN-<UTC>.md" — staged means the git INDEX (P2's/P3's "tracked"
      // language), not merely written to disk. Staged before the first removal. F6: `spawnSync` never
      // throws on a nonzero git exit (e.g. a held .git/index.lock), so the status MUST be read — an
      // ignored exit here is exactly how a failed stage let a removal proceed unstaged.
      const firstStage = spawnSync('git', ['add', '--', cleanPath], { cwd: root, stdio: 'ignore' });
      if (firstStage.status !== 0) throw new Error(`refused: stage-failed (git add exited ${firstStage.status})`);
    } catch (err) {
      entry.refused = `could not stage ${path.basename(cleanPath)}: ${err.message}`;
      report.folders.push(entry);
      continue;
    }

    for (const claim of ordered) {
      // P3: "A path a tracked folder file cites leaves only with a tracked tombstone" — cited-by is
      // computed for every kind that can be trashed (temp AND worktree), never temp-only.
      const citedBy = citedByFor(root, folder, claim);
      const r = attemptRemoval(root, folder, claim, ctx);
      entry.results.push({ id: claim.id, kind: claim.kind, ...r, citedBy });
      if (r.trashed) doc.removals.push({ act: 'trashed', ...r.trashed, citedBy });
      if (r.deleted) doc.removals.push({ act: 'deleted', ...r.deleted });
      fs.writeFileSync(cleanPath, buildCleanDoc(doc));
    }

    // E1/E2: the after-inventory is written whenever a CLEAN-*.md was staged, even if every removal
    // then held — never skipped just because nothing moved.
    doc.after = buildInventory(root, ordered, neverTouch);
    fs.writeFileSync(cleanPath, buildCleanDoc(doc));
    // §2/C7: staged again, finally, with the after-inventory. The removals above already ran, so a
    // failure here cannot be undone — but it MUST be surfaced, never swallowed the way F6's first
    // stage was: `finalStageFailed` carries the git exit code so the CLI can report it loudly and
    // fail `--clean` (main()), rather than leave the record silently untracked on disk.
    const finalStage = spawnSync('git', ['add', '--', cleanPath], { cwd: root, stdio: 'ignore' });
    if (finalStage.status !== 0) entry.finalStageFailed = finalStage.status;
    entry.cleanFile = path.basename(cleanPath);
    report.folders.push(entry);
  }

  return report;
}

// ---- CLI -------------------------------------------------------------------------------------

function usage() {
  return [
    'usage: node closure.mjs <folder> --scan',
    '       node closure.mjs <folder> --close [--follow-up "<text>"]...',
    '       node closure.mjs <folder> --check',
    '       node closure.mjs <folder> --claim temp <name>',
    '       node closure.mjs <folder> --claim worktree <name> --base <ref> [--branch <b>]',
    '       node closure.mjs <folder> --claim branch <name> --base <ref>',
    '       node closure.mjs --clean [--dry-run] [--root <path>]',
    '       node closure.mjs --debt [--root <path>]',
  ].join('\n');
}

function resolveFolderArg(root, arg) {
  if (!arg || arg.startsWith('--')) return null;
  const abs = path.isAbsolute(arg) ? arg : path.join(root, arg);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return abs;
  const live = path.join(root, '.spire', 'clusters', 'tech', 'contracts', arg);
  if (fs.existsSync(live)) return live;
  const archived = path.join(root, '.spire', 'clusters', 'tech', 'contracts', '_archive', arg);
  if (fs.existsSync(archived)) return archived;
  return null;
}

/**
 * @param {string[]} argv script-first convention (argv[0] ignored, like contract_lint.mjs)
 * @param {{root?: string}} [opts] programmatic root override (takes precedence over --root)
 */
export function main(argv, { root } = {}) {
  const raw = argv.slice(1);
  // --root is a general flag (defaulting the way _project.mjs's own ROOT does), not --debt-only.
  const rootIdx = raw.indexOf('--root');
  // Any explicit --root FLAG points somewhere other than this tool's own installed location: C8's
  // "foreign --root dry-runs" — a programmatic { root } option (the exports-take-root precedent) is
  // NOT foreign, since that is the tool operating on its own resolved root, not reaching elsewhere.
  const foreignRoot = rootIdx !== -1;
  const cliRoot = rootIdx !== -1 ? raw[rootIdx + 1] : null;
  const args = rootIdx !== -1 ? [...raw.slice(0, rootIdx), ...raw.slice(rootIdx + 2)] : raw;
  const effectiveRoot = root || cliRoot || ROOT;

  if (args[0] === '--debt') {
    const findings = closureDebt(effectiveRoot);
    console.log(`closure --debt — scanning ${effectiveRoot}`);
    if (!findings.length) {
      console.log('  OK — no closure debt.');
      return 0;
    }
    for (const msg of findings) console.log(`  ERROR  ${msg}`);
    console.log(`\n  ${findings.length} error(s).`);
    return 1;
  }

  if (args[0] === '--clean') {
    const dryRun = args.includes('--dry-run');
    const report = runSweep(effectiveRoot, { dryRun, foreignRoot });
    console.log(`closure --clean — ${effectiveRoot}${foreignRoot ? ' (foreign --root: dry-run only)' : dryRun ? ' (dry-run)' : ''}`);
    let finalStageFailed = false;
    for (const f of report.folders) {
      console.log(`  ${f.folder}${f.refused ? `: REFUSED ${f.refused}` : ''}`);
      for (const r of f.results) {
        const outcome = r.trashed ? `trashed -> ${r.trashed.dest}`
          : r.deleted ? `deleted sha=${r.deleted.sha}`
            : r.wouldTrash ? 'would trash' : r.wouldDelete ? 'would delete' : r.hold;
        console.log(`    ${r.kind} ${r.id}: ${outcome}`);
      }
      if (f.finalStageFailed) {
        finalStageFailed = true;
        // F6, other half: never silent — the removals above already ran; only the record's FINAL
        // staging failed, so what would satisfy this is re-running `git add -- <path>` by hand.
        console.log(`    ERROR: ${f.cleanFile} could not be staged after the sweep (git add exited ${f.finalStageFailed}) — it is on disk but untracked; run "git add -- ${path.join(f.folder, f.cleanFile)}" before committing`);
      }
    }
    return finalStageFailed ? 1 : 0;
  }

  const folder = resolveFolderArg(effectiveRoot, args[0]);
  const mode = args.find((a) => a === '--scan' || a === '--close' || a === '--check' || a === '--claim');
  if (!folder || !mode) {
    console.log(usage());
    return 2;
  }
  const followUps = [];
  args.forEach((a, i) => { if (a === '--follow-up') followUps.push(args[i + 1]); });

  if (mode === '--claim') {
    const idx = args.indexOf('--claim');
    const kind = args[idx + 1];
    const id = args[idx + 2];
    const baseIdx = args.indexOf('--base');
    const branchIdx = args.indexOf('--branch');
    const result = runClaim(effectiveRoot, folder, kind, {
      id,
      base: baseIdx !== -1 ? args[baseIdx + 1] : undefined,
      branch: branchIdx !== -1 ? args[branchIdx + 1] : undefined,
    });
    console.log(`closure --claim ${kind} — ${path.basename(folder)}`);
    if (!result.ok) {
      console.log(`  REFUSED ${result.reason}`);
      return 1;
    }
    console.log(`  claimed ${result.id}`);
    return 0;
  }

  if (mode === '--scan') {
    const { path: closurePath } = runScan(effectiveRoot, folder);
    console.log(`closure --scan — wrote ${path.relative(effectiveRoot, closurePath)}`);
    return 0;
  }

  if (mode === '--check') {
    const refusals = computeRefusals(effectiveRoot, folder);
    console.log(`closure --check — ${path.basename(folder)}`);
    if (!refusals.length) {
      console.log('  OK — no findings.');
      return 0;
    }
    for (const r of refusals) console.log(`  REFUSED ${r.code}: ${r.message}`);
    return 1;
  }

  const result = runClose(effectiveRoot, folder, { followUps, foreignRoot });
  console.log(`closure --close — ${path.basename(folder)}`);
  if (!result.ok) {
    for (const r of result.refusals) console.log(`  REFUSED ${r.code}: ${r.message}`);
    return 1;
  }
  console.log('  PASS');
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(['closure.mjs', ...process.argv.slice(2)]);
}
