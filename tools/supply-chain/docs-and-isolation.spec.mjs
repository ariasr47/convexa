import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
const read = () => fs.readFile('docs/SUPPLY_CHAIN.md', 'utf8');
const readme = () => fs.readFile('README.md', 'utf8');
test('runbook exists', async () => assert.match(await read(), /Dependabot/));
test('deploy prerequisite links policy', async () =>
  assert.match(await fs.readFile('docs/DEPLOY_RUNBOOK.md', 'utf8'), /SUPPLY_CHAIN/));
test('docs contain host limitation', async () =>
  assert.match(await read(), /Railway or Cloudflare/));
test('no application source supply-chain import', async () =>
  assert.doesNotMatch(await fs.readFile('package.json', 'utf8'), /supply-chain.*dashboard/));
test('docs explain human approval', async () =>
  assert.match(await read(), /Humans review and merge/));
test('docs explain no auto merge', async () => assert.match(await read(), /no auto-merge/));
test('docs explain lock authority', async () => assert.match(await read(), /lockfiles/));
test('docs explain candidate tuple', async () => assert.match(await read(), /Node\/npm\/Rust/));
test('docs explain no trader surface', async () => assert.match(await read(), /trader-facing/));
test('docs explain rerun command', async () => assert.match(await read(), /test:tools/));
test('docs explain evidence scope', async () =>
  assert.match(await read(), /GitHub-built subjects/));
test('deploy has prerequisite heading', async () =>
  assert.match(await fs.readFile('docs/DEPLOY_RUNBOOK.md', 'utf8'), /Supply-chain prerequisite/));
test('README setup derives the exact pending candidate tuple from the pin manifest', async () => {
  const candidate = JSON.parse(await fs.readFile('.supply-chain/candidate-toolchain.json', 'utf8')),
    text = await readme();
  assert.equal(candidate.status, 'candidate');
  assert.match(text, /Candidate — qualification pending/);
  assert.ok(
    text.includes(
      `Node \`${candidate.node}\`, npm \`${candidate.npm}\`, and Rust \`${candidate.rust}\``,
    ),
  );
  assert.match(
    text,
    /Current accepted selectors remain in force until candidate binding is complete\./,
  );
});
test('README has one canonical runbook link, locked install, and no premature support claim', async () => {
  const candidate = JSON.parse(await fs.readFile('.supply-chain/candidate-toolchain.json', 'utf8')),
    text = await readme();
  assert.equal((text.match(/docs\/SUPPLY_CHAIN\.md/g) ?? []).length, 1);
  assert.match(text, /\[Supply-chain operations\]\(docs\/SUPPLY_CHAIN\.md\)/);
  assert.match(text, /\bnpm ci\b/);
  if (candidate.status === 'candidate') {
    const candidateBlock = text.slice(text.indexOf('Candidate — qualification pending'));
    assert.doesNotMatch(candidateBlock, /\b(?:is|are|now) supported\b/i);
  }
});
