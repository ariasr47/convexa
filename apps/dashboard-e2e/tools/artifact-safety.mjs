import fs from 'node:fs';
import path from 'node:path';
const SECRET =
  /(authorization:|cookie:|bearer\s|password|api[_-]?key|access[_-]?token|secret|private[_-]?key)/i;
const NON_LOOPBACK = /https?:\/\/(?!localhost(?::\d+)?\b|127\.0\.0\.1(?::\d+)?\b)/i;
export function scanArtifactTree(root) {
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else files.push(file);
    }
  };
  walk(root);
  const violations = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (
      SECRET.test(text) ||
      NON_LOOPBACK.test(text) ||
      /[\w.+-]+@(?!fixture\.invalid\b)[\w.-]+\.[a-z]{2,}/i.test(text)
    )
      violations.push(file);
  }
  return { ok: violations.length === 0, violations };
}
export function assertArtifactSafe(root) {
  const result = scanArtifactTree(root);
  if (!result.ok) throw new Error(`unsafe artifacts: ${result.violations.join(', ')}`);
  return result;
}
