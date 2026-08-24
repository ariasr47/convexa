import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const run = (source) =>
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', source],
    {
      cwd: process.cwd(),
      stdio: 'pipe',
    },
  );

test('readiness rejects empty, wrong, forbidden, and zero-count states', () => {
  const source = `
    import { assertReady } from './apps/dashboard-e2e/src/quality/readiness.ts';
    const values = new Map([['ready', [{ count: 1, text: 'Mounted' }]], ['forbidden', []]]);
    const page = { locator(selector) {
      const rows = selector === '[data-ready]' ? values.get('ready') : values.get('forbidden');
      return { async waitFor() {}, async count() { return rows.length; }, first() { return this; }, async innerText() { return rows[0]?.text ?? ''; } };
    }};
    await assertReady(page, { ready: [{ selector: '[data-ready]', count: 1, text: 'Mounted' }], forbidden: [{ selector: '[data-forbidden]' }] });
    values.set('ready', []);
    try { await assertReady(page, { ready: [{ selector: '[data-ready]', count: 1 }], forbidden: [{ selector: '[data-forbidden]' }] }); process.exit(1); } catch {}
    values.set('ready', [{ count: 1, text: 'Wrong' }]);
    try { await assertReady(page, { ready: [{ selector: '[data-ready]', count: 1, text: 'Mounted' }], forbidden: [{ selector: '[data-forbidden]' }] }); process.exit(2); } catch {}
    values.set('forbidden', [{ count: 1, text: 'poison' }]);
    try { await assertReady(page, { ready: [{ selector: '[data-ready]', count: 1 }], forbidden: [{ selector: '[data-forbidden]' }] }); process.exit(3); } catch {}
  `;
  assert.doesNotThrow(() => run(source));
});
