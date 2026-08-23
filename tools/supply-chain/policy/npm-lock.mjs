import path from 'node:path';
const registry = 'https://registry.npmjs.org/';
export function checkNpmLock(
  lock,
  {
    workspaceRoot = process.cwd(),
    workspaces = lock?.packages?.['']?.workspaces ?? ['apps/*', 'libs/*'],
  } = {},
) {
  if (!lock || lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object')
    return out('blocked', 'npm-lock-invalid', 'malformed');
  for (const [packagePath, pkg] of Object.entries(lock.packages)) {
    if (!pkg || typeof pkg !== 'object') return out('blocked', 'npm-lock-invalid', 'malformed');
    if (!packagePath) continue;
    const workspacePath = pkg.link ? (pkg.resolved ?? packagePath) : packagePath;
    if (isWorkspace(workspacePath, workspaces)) {
      const absolute = path.resolve(workspaceRoot, workspacePath);
      const inside = absolute.startsWith(`${path.resolve(workspaceRoot)}${path.sep}`);
      if (!inside) return out('fail', 'npm-workspace-link', 'complete', packagePath);
      continue;
    }
    if (pkg.link) return out('fail', 'npm-workspace-link', 'complete', packagePath);
    if (typeof pkg.resolved !== 'string' || !pkg.resolved.startsWith(registry))
      return out('fail', 'npm-source', 'complete', packagePath);
    try {
      const u = new URL(pkg.resolved);
      if (u.username || u.password || u.protocol !== 'https:' || u.host !== 'registry.npmjs.org')
        return out('fail', 'npm-source', 'complete', packagePath);
    } catch {
      return out('fail', 'npm-source', 'complete', packagePath);
    }
    if (
      typeof pkg.integrity !== 'string' ||
      !/^sha(256|384|512)-[A-Za-z0-9+/]+={0,2}$/.test(pkg.integrity)
    )
      return out('fail', 'npm-integrity', 'complete', packagePath);
  }
  return out('pass', 'npm-lock-valid', 'complete');
}
const out = (state, rule_id, completion, subject = null) => ({
  state,
  rule_id,
  completion,
  subject,
});
function isWorkspace(value, patterns) {
  const candidate = String(value).replaceAll('\\', '/');
  return patterns.some((pattern) => {
    const normalized = String(pattern).replaceAll('\\', '/');
    if (!normalized.includes('*')) return candidate === normalized;
    const [prefix, suffix] = normalized.split('*');
    const middle = candidate.slice(prefix.length, candidate.length - suffix.length);
    return (
      candidate.startsWith(prefix) &&
      candidate.endsWith(suffix) &&
      middle.length > 0 &&
      !middle.includes('/')
    );
  });
}
