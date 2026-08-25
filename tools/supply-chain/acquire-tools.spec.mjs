import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { externalExecutablePath } from './acquire-tools.mjs';

test('repository tool manifest hashes match the current checked-in bytes', async () => {
  const manifest = JSON.parse(await fs.readFile('.supply-chain/tools.json', 'utf8'));
  for (const tool of manifest.tools.filter((record) => record.source_kind === 'repository')) {
    const bytes = await fs.readFile(tool.source_locator);
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(actual, tool.sha256, `${tool.tool_id} repository checksum`);
  }
});

test('cargo-deny resolves the executable inside its versioned archive directory', () => {
  const base = path.join('tools', 'cargo-deny', '0.20.2');
  assert.equal(
    externalExecutablePath(base, { tool_id: 'cargo-deny', version: '0.20.2' }),
    path.join(base, 'cargo-deny-0.20.2-x86_64-unknown-linux-musl', 'cargo-deny'),
  );
});

test('direct-root tool archives keep their existing executable layout', () => {
  assert.equal(
    externalExecutablePath('tools/gitleaks/8.30.1', {
      tool_id: 'gitleaks',
      version: '8.30.1',
    }),
    path.join('tools/gitleaks/8.30.1', 'gitleaks'),
  );
});

test('supply-chain jobs activate the tool manifest Node and npm runtime', async () => {
  const candidate = JSON.parse(await fs.readFile('.supply-chain/candidate-toolchain.json', 'utf8'));
  const manifest = JSON.parse(await fs.readFile('.supply-chain/tools.json', 'utf8'));
  const npm = manifest.tools.find((tool) => tool.tool_id === 'npm');
  const workflow = await fs.readFile('.github/workflows/supply-chain.yml', 'utf8');
  const configuredVersions = [...workflow.matchAll(/^\s+node-version:\s*([^\s#]+)\s*$/gm)].map(
    (match) => match[1],
  );

  assert.equal(npm.version, candidate.npm);
  assert.match(npm.source_locator, new RegExp(`/v${candidate.node}/`));
  assert.equal(configuredVersions.length, 4);
  assert.deepEqual(configuredVersions, Array(4).fill(candidate.node));
  assert.doesNotMatch(workflow, /node-version-file:\s*\.nvmrc/);
});
