import fs from 'node:fs';
import path from 'node:path';

export const PUBLICATION_GATES = ['chromium', 'compatibility', 'accessibility', 'visual'];

export function validatePublication(root) {
  const failures = [];
  for (const gate of PUBLICATION_GATES) {
    const directory = path.join(root, 'apps/dashboard-e2e/test-output/playwright', gate);
    const summaryPath = path.join(directory, 'summary.json');
    if (!fs.existsSync(directory)) {
      failures.push(`${gate}: missing artifact root`);
      continue;
    }
    if (!fs.existsSync(summaryPath)) failures.push(`${gate}: missing summary.json`);
    else {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        if (summary.gate !== gate) failures.push(`${gate}: summary gate mismatch`);
      } catch {
        failures.push(`${gate}: invalid summary.json`);
      }
    }
    if (fs.readdirSync(directory).length === 0) failures.push(`${gate}: empty artifact root`);
  }
  if (failures.length) throw new Error(`browser publication incomplete: ${failures.join('; ')}`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const root = path.resolve(import.meta.dirname, '../..');
  validatePublication(root);
  console.log('browser publication: four artifact roots present');
}
