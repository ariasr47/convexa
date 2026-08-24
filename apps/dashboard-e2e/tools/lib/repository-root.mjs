import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_PACKAGE = '@convexa/source';

export function repositoryRoot(moduleDirectory, parentCount = 3) {
  const root = path.resolve(moduleDirectory, ...Array.from({ length: parentCount }, () => '..'));
  const packagePath = path.join(root, 'package.json');
  const manifestPath = path.join(root, 'apps', 'dashboard-e2e', 'src', 'quality', 'manifest.json');
  if (!fs.existsSync(packagePath) || !fs.existsSync(manifestPath))
    throw new Error('browser quality repository root is missing its package or manifest');
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    throw new Error('browser quality repository root has an unreadable package.json');
  }
  if (packageJson.name !== EXPECTED_PACKAGE || packageJson.private !== true)
    throw new Error('browser quality repository root is not the Convexa workspace');
  return root;
}

// This helper lives one directory below the tools directory, so it needs one
// additional hop compared with modules directly under tools/.
export const ROOT = repositoryRoot(import.meta.dirname, 4);
