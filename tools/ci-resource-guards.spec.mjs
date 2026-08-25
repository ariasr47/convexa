import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('backend CI releases debug artifacts before the production build', async () => {
  const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf8');
  const postgresSafety = workflow.indexOf('- name: PostgreSQL release safety');
  const cleanup = workflow.indexOf('- name: Free debug build space');
  const releaseBuild = workflow.indexOf('- name: Cargo release build (postgres)');

  assert.ok(postgresSafety >= 0, 'PostgreSQL release safety step is missing');
  assert.ok(cleanup > postgresSafety, 'cleanup must preserve all debug-mode database checks');
  assert.ok(releaseBuild > cleanup, 'cleanup must run immediately before the production build');
  assert.match(workflow.slice(cleanup, releaseBuild), /run:\s*cargo clean/);
});
