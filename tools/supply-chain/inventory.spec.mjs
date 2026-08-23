import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  bomRef,
  compareComponents,
  componentSetHash,
  deriveCargoComponents,
  deriveNpmComponents,
} from './component-oracle.mjs';
import { generateInventoryWithSyft, makeInventory, validateInventory } from './syft-inventory.mjs';

const registry = (name, version = '1.0.0') => ({
  version,
  resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`,
  integrity: `sha512-${name}`,
  dependencies: {},
});
const external = [
  'react',
  'react-dom',
  'react-router-dom',
  '@mui/material',
  '@emotion/react',
  'recharts',
];
const npmLock = {
  lockfileVersion: 3,
  packages: {
    '': { dependencies: Object.fromEntries(external.map((name) => [name, '1.0.0'])) },
    'apps/dashboard': { name: '@convexa/dashboard', version: '0.0.1' },
    'libs/api': {
      name: '@convexa/api',
      version: '0.0.1',
      dependencies: { 'openapi-fetch': '1.0.0' },
    },
    ...Object.fromEntries(external.map((name) => [`node_modules/${name}`, registry(name)])),
    'node_modules/openapi-fetch': registry('openapi-fetch'),
  },
};
const workspaceManifests = {
  'apps/dashboard': {
    path: 'apps/dashboard/package.json',
    bytes: Buffer.from('{"name":"@convexa/dashboard"}'),
  },
  'libs/api': { path: 'libs/api/package.json', bytes: Buffer.from('{"name":"@convexa/api"}') },
};

test('npm oracle derives only production closure and exact two workspace identities', () => {
  const lock = structuredClone(npmLock);
  lock.packages[''].devDependencies = { evil: '1' };
  lock.packages['node_modules/evil'] = registry('evil');
  const components = deriveNpmComponents({ lock, workspaceManifests });
  assert.equal(
    components.some((x) => x.name === 'evil'),
    false,
  );
  assert.deepEqual(
    components
      .filter((x) => x.family === 'convexa-workspace')
      .map((x) => x.name)
      .sort(),
    ['@convexa/api', '@convexa/dashboard'],
  );
  assert.equal(
    components.some((x) => x.name === 'openapi-fetch'),
    true,
  );
});

test('npm oracle blocks missing required seed', () => {
  const lock = structuredClone(npmLock);
  delete lock.packages[''].dependencies.recharts;
  assert.throws(() => deriveNpmComponents({ lock, workspaceManifests }), /required-seed/);
});
test('npm oracle blocks alternate registry provenance', () => {
  const lock = structuredClone(npmLock);
  lock.packages['node_modules/react'].resolved = 'https://packages.example/react.tgz';
  assert.throws(() => deriveNpmComponents({ lock, workspaceManifests }), /npm-provenance/);
});

function cargoFixture() {
  const repoRoot = path.resolve('C:/fixture');
  const ids = ['api-rust', 'quant-engine', 'axum', 'tokio', 'sqlx', 'reqwest', 'dev-only'];
  const packages = ids.map((name) => ({
    id: name,
    name,
    version: name === 'api-rust' || name === 'quant-engine' ? '0.1.0' : '1.0.0',
    manifest_path: path.join(
      repoRoot,
      name === 'api-rust'
        ? 'apps/api/Cargo.toml'
        : name === 'quant-engine'
          ? 'libs/quant-engine/Cargo.toml'
          : `registry/${name}/Cargo.toml`,
    ),
    source:
      name === 'api-rust' || name === 'quant-engine'
        ? null
        : 'registry+https://github.com/rust-lang/crates.io-index',
    checksum: name === 'api-rust' || name === 'quant-engine' ? null : `checksum-${name}`,
  }));
  const deps = ['quant-engine', 'axum', 'tokio', 'sqlx', 'reqwest']
    .map((pkg) => ({ pkg, dep_kinds: [{ kind: null, target: null }] }))
    .concat({ pkg: 'dev-only', dep_kinds: [{ kind: 'dev', target: null }] });
  return {
    repoRoot,
    manifestBytes: {
      'apps/api/Cargo.toml': Buffer.from('[package]'),
      'libs/quant-engine/Cargo.toml': Buffer.from('[package]'),
    },
    metadata: {
      packages,
      workspace_members: ['api-rust', 'quant-engine'],
      resolve: { nodes: ids.map((id) => ({ id, deps: id === 'api-rust' ? deps : [] })) },
    },
  };
}

test('Cargo oracle traverses normal/build and excludes dev-only dependencies', () => {
  const fixture = cargoFixture();
  const components = deriveCargoComponents(fixture);
  assert.equal(
    components.some((x) => x.name === 'dev-only'),
    false,
  );
  assert.deepEqual(
    components
      .filter((x) => x.family === 'convexa-workspace')
      .map((x) => x.name)
      .sort(),
    ['api-rust', 'quant-engine'],
  );
});
test('Cargo oracle blocks checksum-less registry package', () => {
  const fixture = cargoFixture();
  fixture.metadata.packages.find((x) => x.name === 'axum').checksum = null;
  assert.throws(() => deriveCargoComponents(fixture), /cargo-provenance/);
});

test('component-set comparison rejects omission, arbitrary additions, duplicates and provenance mutation', () => {
  const expected = deriveNpmComponents({ lock: npmLock, workspaceManifests });
  assert.equal(compareComponents(expected, expected), true);
  assert.equal(compareComponents(expected, expected.slice(1)), false);
  assert.equal(
    compareComponents(expected, [...expected, { ...expected[2], name: 'arbitrary' }]),
    false,
  );
  assert.equal(compareComponents(expected, [...expected, expected[0]]), false);
  assert.equal(
    compareComponents(
      expected,
      expected.map((x, i) =>
        i ? x : { ...x, provenance: { ...x.provenance, manifest_sha256: 'f'.repeat(64) } },
      ),
    ),
    false,
  );
});

test('CycloneDX validator binds subject, exact bom refs, required seeds and set hash', () => {
  const expected = deriveNpmComponents({ lock: npmLock, workspaceManifests }),
    subjectId = 'dashboard-distribution-archive';
  const inventory = makeInventory(subjectId, expected),
    requiredSeeds = ['@convexa/dashboard', 'react', 'openapi-fetch'];
  const result = validateInventory(expected, inventory, { subjectId, requiredSeeds });
  assert.equal(result.state, 'pass');
  assert.equal(result.component_set_sha256, componentSetHash(expected));
  assert.equal(result.component_count, expected.length);
  const missing = structuredClone(inventory);
  missing.components.pop();
  assert.equal(validateInventory(expected, missing, { subjectId, requiredSeeds }).state, 'fail');
  const duplicate = structuredClone(inventory);
  duplicate.components.push(duplicate.components[0]);
  assert.equal(validateInventory(expected, duplicate, { subjectId, requiredSeeds }).state, 'fail');
  const crossSubject = structuredClone(inventory);
  crossSubject.metadata.properties.find((x) => x.name === 'convexa:subject_id').value =
    'api-production-image';
  assert.equal(
    validateInventory(expected, crossSubject, { subjectId, requiredSeeds }).state,
    'fail',
  );
  const badRef = structuredClone(inventory);
  badRef.components[0]['bom-ref'] = bomRef(expected[1]);
  assert.equal(validateInventory(expected, badRef, { subjectId, requiredSeeds }).state, 'blocked');
});

test('component set hash is order-independent but identity-sensitive', () => {
  const components = deriveNpmComponents({ lock: npmLock, workspaceManifests });
  assert.equal(componentSetHash(components), componentSetHash([...components].reverse()));
  assert.notEqual(
    componentSetHash(components),
    componentSetHash(components.map((x, i) => (i ? x : { ...x, version: '9.9.9' }))),
  );
});

test('hosted Syft adapter executes the pinned tool over every synthetic lock identity', async () => {
  const expected = deriveNpmComponents({ lock: npmLock, workspaceManifests });
  let invoked = false;
  const result = await generateInventoryWithSyft({
    executable: '/pinned/syft',
    subjectId: 'dashboard-distribution-archive',
    expected,
    runner: async (executable, args) => {
      invoked = true;
      assert.equal(executable, '/pinned/syft');
      const root = args[1].slice(4),
        artifacts = [];
      for (const dir of await (await import('node:fs/promises')).readdir(root)) {
        const pkg = JSON.parse(
          await (await import('node:fs/promises')).readFile(path.join(root, dir, 'package.json')),
        );
        artifacts.push({ name: pkg.name, version: pkg.version });
      }
      return {
        state: 'pass',
        raw_exit_code: 0,
        output: JSON.stringify({ artifacts }),
        raw_output_sha256: 'a'.repeat(64),
      };
    },
  });
  assert.equal(invoked, true);
  assert.equal(result.state, 'pass');
  assert.equal(result.inventory.components.length, expected.length);
});
test('Syft omission and unavailable execution fail closed', async () => {
  const expected = deriveNpmComponents({ lock: npmLock, workspaceManifests });
  const omitted = await generateInventoryWithSyft({
    executable: 'syft',
    subjectId: 'dashboard-distribution-archive',
    expected,
    runner: async () => ({
      state: 'pass',
      raw_exit_code: 0,
      output: '{"artifacts":[]}',
      raw_output_sha256: 'a'.repeat(64),
    }),
  });
  assert.equal(omitted.state, 'fail');
  const unavailable = await generateInventoryWithSyft({
    executable: 'syft',
    subjectId: 'dashboard-distribution-archive',
    expected,
    runner: async () => ({
      state: 'blocked',
      raw_exit_code: null,
      output: '',
      raw_output_sha256: 'b'.repeat(64),
    }),
  });
  assert.equal(unavailable.state, 'blocked');
});
