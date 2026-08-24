import fs from 'node:fs';
import path from 'node:path';
import { loadManifest } from './lib/manifest.mjs';
import { validateAcceptance } from './lib/visual-review.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--acceptance') {
  console.error('Acceptance validation requires exactly one --acceptance path.');
  process.exit(2);
}
try {
  const relative = args[1];
  if (
    path.isAbsolute(relative) ||
    relative.includes('\\') ||
    !relative.startsWith('apps/dashboard-e2e/visual-review/acceptances/')
  )
    throw new Error('acceptance must be a repository-relative acceptance path');
  const root = process.cwd();
  const file = path.resolve(root, relative);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  validateAcceptance(value, loadManifest(), root);
  console.log(`[acceptance-valid] ${value.acceptance_id} — externally authored decision verified`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
