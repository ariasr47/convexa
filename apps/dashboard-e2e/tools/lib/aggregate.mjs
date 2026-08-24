export const CHILDREN = Object.freeze([
  { target: 'dashboard-e2e:e2e', gate: 'chromium', port: 4210 },
  { target: 'dashboard-e2e:compat', gate: 'compatibility', port: 4211 },
  { target: 'dashboard-e2e:a11y', gate: 'accessibility', port: 4212 },
  { target: 'dashboard-e2e:visual', gate: 'visual', port: 4213 },
]);
export function validateChildCatalog(children = CHILDREN) {
  if (
    children.length !== 4 ||
    children.some(
      (child, i) => child.target !== CHILDREN[i].target || child.port !== CHILDREN[i].port,
    ) ||
    new Set(children.map((x) => x.target)).size !== 4
  )
    throw new Error('quality child catalog drift');
  return true;
}
export function aggregateStatus(results) {
  return results.every((r) => r.exit_code === 0 && r.status === 'pass')
    ? 'pass'
    : results.some((r) => r.status === 'incomplete' || r.exit_code == null)
      ? 'incomplete'
      : 'fail';
}
