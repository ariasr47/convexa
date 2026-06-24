#!/usr/bin/env node
// PreToolUse hook: block writes outside this monorepo root (system-4b workspace fence).
// Since the GammaFlow backend + web frontend now live in ONE Nx workspace, this is the single
// active fence (the old cross-repo mirror is moot). REPO_ROOT is computed from __dirname, so it
// covers both lanes (apps/api + apps/dashboard) under one root.
// Carve-outs (sanctioned harness write locations outside the repo):
//   - the per-project Claude auto-memory store (~/.claude/projects/<proj>/memory)
//   - the approved-plan store (~/.claude/plans) — runbooks the harness writes/reads
const path = require('path');
const os = require('os');
const REPO_ROOT = path.resolve(__dirname, '..', '..'); // .claude/tools -> repo root
const GUARDED = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let p; try { p = JSON.parse(raw); } catch { process.exit(0); }
  if (!GUARDED.has(p.tool_name)) process.exit(0);
  const ti = p.tool_input || {};
  const t0 = ti.file_path || ti.notebook_path;
  if (!t0) process.exit(0);
  const cwd = p.cwd || REPO_ROOT;
  const target = path.resolve(path.isAbsolute(t0) ? t0 : path.join(cwd, t0));
  // Sanctioned carve-out: the Claude per-project auto-memory store lives OUTSIDE the repo
  // (~/.claude/projects/<proj>/memory); the harness writes it via Write/Edit — allow it.
  const memRel = path.relative(path.join(os.homedir(), '.claude', 'projects'), target);
  if (memRel && !memRel.startsWith('..') && !path.isAbsolute(memRel) && memRel.split(path.sep).includes('memory')) process.exit(0);
  // Sanctioned carve-out: the approved-plan store (~/.claude/plans) — harness-written runbooks.
  const planRel = path.relative(path.join(os.homedir(), '.claude', 'plans'), target);
  if (planRel !== '' && !planRel.startsWith('..') && !path.isAbsolute(planRel)) process.exit(0);
  const rel = path.relative(REPO_ROOT, target);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) process.exit(0);
  process.stderr.write(`path_guard (system-4b): BLOCKED ${p.tool_name} to '${target}' — outside this monorepo (${REPO_ROOT}). Carve-outs: ~/.claude/projects/**/memory, ~/.claude/plans.\n`);
  process.exit(2);
});
