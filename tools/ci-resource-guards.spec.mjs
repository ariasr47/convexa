import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('backend CI frees default-feature artifacts before PostgreSQL tests', async () => {
  const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf8');
  const defaultTests = workflow.indexOf('- name: Cargo test');
  const cleanup = workflow.indexOf('- name: Free default-feature debug build space');
  const postgresGuardrails = workflow.indexOf('- name: Production runtime guardrails (postgres)');

  assert.ok(defaultTests >= 0, 'default-feature Cargo test step is missing');
  assert.ok(cleanup > defaultTests, 'cleanup must follow the default-feature Rust tests');
  assert.ok(postgresGuardrails > cleanup, 'cleanup must precede PostgreSQL compilation');
  assert.match(workflow.slice(cleanup, postgresGuardrails), /run:\s*cargo clean/);
});

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

test('backend CI frees preinstalled runner disk before any Rust compilation', async () => {
  const workflow = await fs.readFile('.github/workflows/ci.yml', 'utf8');
  const freeRunner = workflow.indexOf('- name: Free preinstalled runner disk');
  const toolchain = workflow.indexOf('- name: Install baseline Rust 1.97.1');
  const defaultTests = workflow.indexOf('- name: Cargo test');

  assert.ok(freeRunner >= 0, 'preinstalled-disk cleanup step is missing');
  assert.ok(freeRunner < toolchain, 'cleanup must precede the Rust toolchain install');
  assert.ok(freeRunner < defaultTests, 'cleanup must precede the default-feature Rust tests');
  // The two `cargo clean` steps only reclaim OUR artifacts, and both run after `Cargo test` —
  // so a debug test build large enough to fill the runner fails before either can help.
  assert.match(workflow.slice(freeRunner, toolchain), /sudo rm -rf .*\/usr\/share\/dotnet/);
});
