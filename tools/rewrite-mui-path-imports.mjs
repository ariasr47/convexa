/**
 * One-shot: rewrite `from '@mui/material'` named value imports in dashboard source
 * to path imports so ESLint can forbid the barrel.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteMuiMaterialImports } from './vite-mui-path-imports.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'apps', 'dashboard', 'src');

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.[cm]?[jt]sx?$/.test(ent.name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(srcRoot)) {
  const before = readFileSync(file, 'utf8');
  const after = rewriteMuiMaterialImports(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
  }
}
console.log(`rewrote ${changed} files`);
