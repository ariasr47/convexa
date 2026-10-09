import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  scanArtifact,
  validateEvidenceOutcome,
  validateForbiddenPackages,
  validateOpenapi,
  validateParity,
  validateRegistrationPairs,
} from './api-contract.mjs';

const tool = new URL('./api-contract.mjs', import.meta.url);

test('forbidden route-integration packages are rejected in manifests, lockfile, and resolved set', () => {
  const manifest = readFileSync('apps/api/Cargo.toml', 'utf8');
  const lock = readFileSync('Cargo.lock', 'utf8');
  assert.doesNotThrow(() =>
    validateForbiddenPackages({ cargoManifest: manifest, cargoLock: lock }),
  );
  for (const packageName of ['utoipa-axum', 'paste']) {
    assert.throws(
      () =>
        validateForbiddenPackages({
          cargoManifest: `${manifest}\n${packageName} = \"1.0.0\"`,
          cargoLock: lock,
        }),
      new RegExp(`forbidden package ${packageName}`),
    );
    assert.throws(
      () =>
        validateForbiddenPackages({
          cargoManifest: manifest,
          cargoLock: lock,
          resolvedPackages: [`name = \"${packageName}\"`],
        }),
      new RegExp(`forbidden package ${packageName}`),
    );
  }
});

const openapi = JSON.parse(readFileSync('apps/api/openapi/convexa.openapi.json', 'utf8'));
const parity = JSON.parse(readFileSync('apps/api/openapi/parity-coverage.json', 'utf8'));
const manifest = JSON.parse(
  readFileSync('apps/api/openapi/generated-artifacts.manifest.json', 'utf8'),
);

test('zero operations are refused', () =>
  assert.throws(() => validateOpenapi({ openapi: '3.1.0', paths: {} }), /zero-operation output/));
test('unsupported schema is refused', () =>
  assert.throws(
    () =>
      validateOpenapi({
        openapi: '3.1.0',
        paths: {
          '/x': {
            get: {
              operationId: 'x',
              security: [],
              'x-convexa-security': 'public',
              'x-convexa-surface': 'json',
              responses: { 200: { content: { 'application/json': { schema: {} } } } },
            },
          },
        },
      }),
    /unsupported schema construct/,
  ));
test('incomplete parity inventory is refused', () =>
  assert.throws(
    () =>
      validateParity(
        { schema_version: 1, operation_count: 1, operations: [], normalizer_catalog: [] },
        [{ method: 'GET', path: '/x' }],
      ),
    /incomplete contract coverage/,
  ));
test('invalid OpenAPI shape is refused', () =>
  assert.throws(
    () => validateOpenapi({ openapi: '3.0.3', paths: {} }),
    /invalid OpenAPI artifact/,
  ));
for (const [name, variable, expected] of [
  [
    'missing output recovery',
    'API_CONTRACT_MISSING_OUTPUT',
    /missing output: apps\/api\/openapi\/parity-coverage\.json/,
  ],
  ['zero-operation recovery', 'API_CONTRACT_ZERO_OUTPUT', /zero-operation output/],
  [
    'unsupported construct recovery',
    'API_CONTRACT_UNSUPPORTED_CONSTRUCT',
    /unsupported schema construct/,
  ],
]) {
  test(name, () => {
    const result = spawnSync(process.execPath, ['tools/api-contract.mjs', 'check'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        [variable]:
          variable === 'API_CONTRACT_MISSING_OUTPUT'
            ? 'apps/api/openapi/parity-coverage.json'
            : 'fixture',
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, expected);
  });
}
test('runtime route registration mutation changes exporter inventory and fails preservation check', () => {
  const result = spawnSync(process.execPath, ['tools/api-contract.mjs', 'generate'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, API_CONTRACT_TEST_EXTRA_OPERATION: '1' },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /incomplete contract coverage|contract drift/);
  const restored = spawnSync(process.execPath, ['tools/api-contract.mjs', 'check'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(restored.status, 0);
});

test('simultaneous runtime/OpenAPI omission cannot masquerade as a clean graph', () => {
  const source = readFileSync('apps/api/src/routes/mod.rs', 'utf8');
  const poisoned = source.replace(
    /add!\(stream::stream_ticker, stream::__path_stream_ticker\);\s*/,
    '',
  );
  assert.throws(() => validateRegistrationPairs(poisoned), /registration pairing count/);
  const mutated = structuredClone(openapi);
  delete mutated.paths['/api/stream/prices'];
  const operations = Object.entries(mutated.paths).flatMap(([path, item]) =>
    Object.keys(item)
      .filter((method) =>
        ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method),
      )
      .map((method) => ({ method: method.toUpperCase(), path })),
  );
  assert.throws(() => validateParity(parity, operations, mutated), /incomplete contract coverage/);
});

test('pairing gate rejects every real companion poison and restores clean source', () => {
  const source = readFileSync('apps/api/src/routes/mod.rs', 'utf8');
  const poisons = [
    source.replace(
      'stream::stream_ticker, stream::__path_stream_ticker',
      'stream::stream_ticker, stream::__path_stream_prices',
    ),
    source.replace('add!(stream::stream_ticker, stream::__path_stream_ticker);', ''),
    source.replace(
      'add!(stream::stream_ticker, stream::__path_stream_ticker);',
      'add!(stream::stream_ticker, stream::__path_stream_ticker); add!(stream::stream_ticker, stream::__path_stream_ticker);',
    ),
    source.replace('stream::__path_stream_ticker', 'stream::__path_wrong_stream_ticker'),
  ];
  for (const poisoned of poisons)
    assert.throws(() => validateRegistrationPairs(poisoned), /incomplete contract coverage/);
  assert.doesNotThrow(() => validateRegistrationPairs(source));
});
test('baseline is immutable and hash matches manifest', () => {
  const b = readFileSync('apps/api/openapi/precutover-operation-baseline.json');
  assert.equal(
    createHash('sha256').update(b).digest('hex'),
    manifest.artifacts.find((a) => a.path.includes('precutover')).sha256,
  );
});
test('secret scan rejects env values', () =>
  assert.throws(
    () => scanArtifact('fixture.json', Buffer.from('DATABASE_URL="postgres://secret"')),
    /invalid OpenAPI artifact/,
  ));
test('secret scan rejects API key values', () =>
  assert.throws(
    () => scanArtifact('fixture.json', Buffer.from('API_KEY="abc"')),
    /invalid OpenAPI artifact/,
  ));
test('secret scan rejects production origin in parity', () =>
  assert.throws(
    () => scanArtifact('parity.json', Buffer.from('https://prod.example')),
    /invalid OpenAPI artifact/,
  ));
test('secret scan rejects Windows paths', () =>
  assert.throws(
    () => scanArtifact('fixture.json', Buffer.from('C:\\Users\\secret')),
    /invalid OpenAPI artifact/,
  ));
test('secret scan rejects POSIX paths', () =>
  assert.throws(
    () => scanArtifact('fixture.json', Buffer.from('/home/runner/secret')),
    /invalid OpenAPI artifact/,
  ));
test('openapi artifact contains no schema-less response', () =>
  assert.doesNotThrow(() => validateOpenapi(openapi)));
test('parity operation keys equal OpenAPI keys', () =>
  assert.deepEqual(
    parity.operations.map((o) => o.key).sort(),
    Object.entries(openapi.paths)
      .flatMap(([path, item]) =>
        Object.keys(item)
          .filter((k) => ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(k))
          .map((k) => `${k.toUpperCase()} ${path}`),
      )
      .sort(),
  ));
test('runtime fallback rows are present without legacy top-level fields', () => {
  assert.equal('manual_boundaries' in parity, false);
  assert.equal('runtime_only' in parity, false);
  assert.deepEqual(parity.runtime_router_boundaries.map((r) => r.key).sort(), [
    'runtime:fallback-not-found',
    'runtime:implicit-method',
  ]);
});
test('normalizer references and catalog are set equal', () =>
  assert.deepEqual(
    new Set(parity.normalizer_catalog.map((n) => n.id)),
    new Set(parity.operations.flatMap((o) => o.normalizers)),
  ));
test('check does not write artifacts', () => {
  const paths = manifest.artifacts.map((a) => a.path);
  const before = paths.map((p) => createHash('sha256').update(readFileSync(p)).digest('hex'));
  assert.equal(
    spawnSync(process.execPath, ['tools/api-contract.mjs', 'check'], { encoding: 'utf8' }).status,
    0,
  );
  assert.deepEqual(
    paths.map((p) => createHash('sha256').update(readFileSync(p)).digest('hex')),
    before,
  );
});
test('security mutations are rejected at the contract boundary', () => {
  const mutated = structuredClone(openapi);
  mutated.paths['/api/book'].get.security = [];
  assert.throws(
    () => validateOpenapi(mutated),
    /incomplete contract coverage: security mode at GET \/api\/book/,
  );
});

test('every operation has a closed source-derived surface classification', () => {
  const allowed = new Set([
    'json',
    'html',
    'redirect',
    'bodyless',
    'sse',
    'operator-research',
    'alias',
  ]);
  for (const [path, item] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!operation.responses) continue;
      assert.ok(allowed.has(operation['x-convexa-surface']), `${method} ${path}`);
    }
  }
  const mutated = structuredClone(openapi);
  mutated.paths['/api/health'].get['x-convexa-surface'] = 'sse';
  assert.throws(() => validateOpenapi(mutated), /surface classification drift/);
});

test('candidate consumer compilation happens before atomic install', () => {
  const paths = manifest.artifacts.map((entry) => entry.path);
  const before = paths.map((path) => createHash('sha256').update(readFileSync(path)).digest('hex'));
  const result = spawnSync(process.execPath, ['tools/api-contract.mjs', 'generate'], {
    encoding: 'utf8',
    env: { ...process.env, API_CONTRACT_FAIL_STAGE: 'candidate-compile' },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /generation tooling failure/);
  assert.deepEqual(
    paths.map((path) => createHash('sha256').update(readFileSync(path)).digest('hex')),
    before,
  );
});

test('parity evidence is executable rather than a success-string label', () => {
  const mutated = structuredClone(parity);
  mutated.operations[0].boundaries[0].test = '';
  assert.throws(
    () =>
      validateParity(
        mutated,
        Object.entries(openapi.paths).flatMap(([path, item]) =>
          Object.keys(item)
            .filter((method) =>
              ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method),
            )
            .map((method) => ({ method: method.toUpperCase(), path })),
        ),
      ),
    /incomplete contract coverage/,
  );
});

test('HTTP parity catalog retains materially distinct access outcomes', () => {
  const scenarios = parity.http_parity.scenarios.flatMap((item) => item.allowed_outcomes ?? []);
  assert.ok(scenarios.length > parity.http_parity.scenarios.length);
  assert.ok(scenarios.some((item) => item.access_mode === 'anonymous'));
  assert.ok(scenarios.some((item) => item.access_mode === 'authenticated'));
  assert.ok(scenarios.some((item) => item.access_mode === 'forbidden'));
  assert.deepEqual(
    new Set(parity.http_parity.scenarios.map((item) => item.security_mode)),
    new Set(['public', 'optional-session', 'session', 'oauth-state', 'operator-token']),
  );
});

test('HTTP parity scenarios carry distinct setup/request evidence', () => {
  const source = readFileSync('tools/api-contract.mjs', 'utf8');
  assert.doesNotMatch(source, /HTTP_OUTCOMES/);
  const scenarios = parity.http_parity.scenarios.flatMap((item) => item.allowed_outcomes ?? []);
  assert.ok(scenarios.every((item) => item.setup_fixture && item.request_fixture));
  assert.ok(scenarios.every((item) => item.effect_assertion));
  const tuples = scenarios.map(
    (item) => `${item.access_mode}:${item.status}:${item.setup_fixture}:${item.request_fixture}`,
  );
  assert.equal(new Set(tuples).size, tuples.length);
});

test('HTTP parity scenarios persist explicit durable, memory, and cookie effects', () => {
  const scenarios = parity.http_parity.scenarios.flatMap((item) => item.allowed_outcomes ?? []);
  assert.ok(scenarios.length > parity.http_parity.scenarios.length);
  assert.ok(
    scenarios.every((scenario) => {
      const effect = scenario.mutation_effect;
      return (
        effect &&
        ['none', 'user-created'].includes(effect.durable) &&
        ['none', 'session-created', 'oauth-state-created'].includes(effect.memory) &&
        ['none', 'set', 'clear'].includes(effect.cookie)
      );
    }),
  );
  assert.ok(scenarios.some((scenario) => scenario.mutation_effect.cookie === 'clear'));
});

test('HTTP scenario deletion and signature drift are rejected', () => {
  const ops = Object.entries(openapi.paths).flatMap(([path, item]) =>
    ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
      .filter((method) => item[method])
      .map((method) => ({ method: method.toUpperCase(), path })),
  );
  for (const mutate of [
    (candidate) => candidate.http_parity.scenarios[0].allowed_outcomes.pop(),
    (candidate) => {
      candidate.http_parity.scenarios[0].allowed_outcomes[0].body_meaning = 'empty';
    },
    (candidate) => {
      candidate.http_parity.scenarios[0].allowed_outcomes[0].header_names = ['x-poison'];
    },
    (candidate) => {
      candidate.http_parity.scenarios[0].allowed_outcomes[0].access_mode = 'forbidden';
    },
    (candidate) => {
      candidate.http_parity.scenarios.find(
        (item) => item.key === 'POST /api/auth/logout',
      ).allowed_outcomes[0].state_effect = 'none';
    },
    (candidate) => {
      candidate.http_parity.scenarios.find(
        (item) => item.key === 'POST /api/auth/logout',
      ).allowed_outcomes[0].mutation_effect.cookie = 'none';
    },
  ]) {
    const mutated = structuredClone(parity);
    mutate(mutated);
    assert.throws(() => validateParity(mutated, ops, openapi), /incomplete contract coverage/);
  }
});

test('every persisted boundary signature rejects status/header/media/security/body mutations', () => {
  const ops = Object.entries(openapi.paths).flatMap(([path, item]) =>
    ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
      .filter((method) => item[method])
      .map((method) => ({ method: method.toUpperCase(), path })),
  );
  for (const field of [
    'status',
    'header_names',
    'media_type',
    'security_mode',
    'body_schema_signature',
  ]) {
    const mutated = structuredClone(parity);
    const boundary = mutated.operations[0].boundaries[0];
    if (field === 'status') boundary.status = '599';
    else if (field === 'header_names') boundary.header_names = ['X-poison'];
    else if (field === 'media_type') boundary.media_type = 'text/plain';
    else if (field === 'security_mode') boundary.security_mode = 'session';
    else boundary.body_schema_signature = '{}';
    assert.throws(() => validateParity(mutated, ops, openapi), /incomplete contract coverage/);
  }
});

test('the exhaustive signature and mutation matrix is non-vacuous', () => {
  const boundaries = parity.operations.flatMap((operation) => operation.boundaries);
  assert.ok(boundaries.length > 0);
  assert.equal(new Set(boundaries.map((boundary) => boundary.boundary_id)).size, boundaries.length);
  assert.ok(
    boundaries.every((boundary) =>
      parity.http_parity.scenarios.some((item) => item.key === boundary.http_case_id),
    ),
  );
  const ops = Object.entries(openapi.paths).flatMap(([path, item]) =>
    ['get', 'post', 'put', 'delete', 'patch', 'head', 'options']
      .filter((method) => item[method])
      .map((method) => ({ method: method.toUpperCase(), path })),
  );
  let attempted = 0;
  for (let operationIndex = 0; operationIndex < parity.operations.length; operationIndex++) {
    for (
      let boundaryIndex = 0;
      boundaryIndex < parity.operations[operationIndex].boundaries.length;
      boundaryIndex++
    ) {
      for (const field of [
        'status',
        'header_names',
        'media_type',
        'security_mode',
        'body_schema_signature',
      ]) {
        const mutated = structuredClone(parity);
        const boundary = mutated.operations[operationIndex].boundaries[boundaryIndex];
        if (field === 'status') boundary.status = '599';
        else if (field === 'header_names') boundary.header_names = ['X-poison'];
        else if (field === 'media_type')
          boundary.media_type =
            boundary.media_type === 'text/plain' ? 'application/json' : 'text/plain';
        else if (field === 'security_mode')
          boundary.security_mode = boundary.security_mode === 'session' ? 'public' : 'session';
        else boundary.body_schema_signature = '{}';
        assert.throws(
          () => validateParity(mutated, ops, openapi),
          /incomplete contract coverage/,
          `${operationIndex}/${boundaryIndex}/${field}`,
        );
        attempted++;
      }
    }
  }
  assert.equal(attempted, boundaries.length * 5);
});

test('offline dead-proxy generate and check are deterministic', () => {
  const env = {
    ...process.env,
    npm_config_offline: 'true',
    HTTP_PROXY: 'http://127.0.0.1:9',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: '*',
  };
  const paths = manifest.artifacts.map((entry) => entry.path);
  const run = spawnSync(process.execPath, ['tools/api-contract.mjs', 'generate'], {
    encoding: 'utf8',
    env,
  });
  assert.equal(run.status, 0, run.stderr);
  const first = paths.map((path) => createHash('sha256').update(readFileSync(path)).digest('hex'));
  const runAgain = spawnSync(process.execPath, ['tools/api-contract.mjs', 'generate'], {
    encoding: 'utf8',
    env,
  });
  assert.equal(runAgain.status, 0, runAgain.stderr);
  const second = paths.map((path) => createHash('sha256').update(readFileSync(path)).digest('hex'));
  assert.deepEqual(second, first);
  const check = spawnSync(process.execPath, ['tools/api-contract.mjs', 'check'], {
    encoding: 'utf8',
    env,
  });
  assert.equal(check.status, 0, check.stderr);
});

test('canonical commands are independent of caller working directory', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'convexa-contract-cwd-'));
  try {
    const env = {
      ...process.env,
      npm_config_offline: 'true',
      HTTP_PROXY: 'http://127.0.0.1:9',
      HTTPS_PROXY: 'http://127.0.0.1:9',
    };
    const toolPath = fileURLToPath(tool);
    for (const command of ['generate', 'check']) {
      const result = spawnSync(process.execPath, [toolPath, command], {
        cwd,
        encoding: 'utf8',
        env,
      });
      assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('two disposable workspace roots generate identical offline trees', () => {
  const workspace = fileURLToPath(new URL('..', import.meta.url));
  const fixture = join(workspace, 'apps/api/openapi/convexa.openapi.json');
  const toolPath = join(workspace, 'tools/api-contract.mjs');
  const roots = [
    mkdtempSync(join(workspace, 'api-contract-root-a-')),
    mkdtempSync(join(workspace, 'api-contract-root-b-')),
  ];
  const relativeCopies = [
    'apps/api/openapi/precutover-operation-baseline.json',
    'libs/api',
    'apps/dashboard',
    'apps/api/tests/fixtures/api_contract',
    'apps/api/tests/api_contract_parity.rs',
    'apps/api/tests/api_contract_runtime_auth_research.rs',
    'apps/api/tests/api_contract_runtime_market_stream.rs',
    'tsconfig.base.json',
  ];
  const artifacts = [
    'apps/api/openapi/convexa.openapi.json',
    'apps/api/openapi/parity-coverage.json',
    'apps/api/openapi/generated-artifacts.manifest.json',
    'libs/api/src/generated/schema.ts',
  ];
  const env = {
    ...process.env,
    API_CONTRACT_TOOLCHAIN_ROOT: workspace,
    API_CONTRACT_EXPORT_FIXTURE: fixture,
    npm_config_offline: 'true',
    HTTP_PROXY: 'http://127.0.0.1:9',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: '*',
  };
  try {
    for (const root of roots) {
      for (const relativePath of relativeCopies)
        cpSync(join(workspace, relativePath), join(root, relativePath), { recursive: true });
      const dashboardConfigPath = join(root, 'apps/dashboard/tsconfig.app.json');
      const dashboardConfig = JSON.parse(readFileSync(dashboardConfigPath, 'utf8'));
      dashboardConfig.compilerOptions.lib = [
        ...(dashboardConfig.compilerOptions.lib ?? []),
        'dom.iterable',
      ];
      writeFileSync(dashboardConfigPath, JSON.stringify(dashboardConfig, null, 2));
      const rootEnv = { ...env, API_CONTRACT_ROOT: root };
      for (const command of ['generate', 'check']) {
        const result = spawnSync(process.execPath, [toolPath, command], {
          cwd: root,
          encoding: 'utf8',
          env: rootEnv,
        });
        assert.equal(result.status, 0, `${root} ${command}: ${result.stderr}`);
      }
    }
    const hashes = roots.map((root) =>
      artifacts.map((relativePath) => {
        const bytes = readFileSync(join(root, relativePath));
        assert.doesNotMatch(bytes.toString('utf8'), /[A-Za-z]:\\|\/Users\/|\/home\//);
        return createHash('sha256').update(bytes).digest('hex');
      }),
    );
    assert.deepEqual(hashes[0], hashes[1]);
    for (const root of roots) {
      const before = artifacts.map((relativePath) =>
        createHash('sha256')
          .update(readFileSync(join(root, relativePath)))
          .digest('hex'),
      );
      const result = spawnSync(process.execPath, [toolPath, 'check'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...env, API_CONTRACT_ROOT: root },
      });
      assert.equal(result.status, 0, `${root} non-writing check: ${result.stderr}`);
      const after = artifacts.map((relativePath) =>
        createHash('sha256')
          .update(readFileSync(join(root, relativePath)))
          .digest('hex'),
      );
      assert.deepEqual(after, before);
    }
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});

test('normalizer omission is rejected even when operation keys remain equal', () => {
  const mutated = structuredClone(parity);
  mutated.normalizer_catalog = [];
  assert.throws(
    () =>
      validateParity(
        mutated,
        Object.entries(openapi.paths).flatMap(([path, item]) =>
          Object.keys(item)
            .filter((method) =>
              ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method),
            )
            .map((method) => ({ method: method.toUpperCase(), path })),
        ),
      ),
    /incomplete contract coverage/,
  );
});

test('generation stage failure restores every mutable byte', () => {
  const paths = manifest.artifacts.map((entry) => entry.path);
  const before = paths.map((path) => createHash('sha256').update(readFileSync(path)).digest('hex'));
  const result = spawnSync(process.execPath, ['tools/api-contract.mjs', 'generate'], {
    encoding: 'utf8',
    env: { ...process.env, API_CONTRACT_FAIL_AFTER_KEY: 'parity' },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /generation tooling failure/);
  assert.deepEqual(
    paths.map((path) => createHash('sha256').update(readFileSync(path)).digest('hex')),
    before,
  );
});

test('every parity evidence entry resolves to a real Rust test and fixture', () => {
  const sourceCache = new Map();
  for (const item of parity.evidence_catalog) {
    assert.ok(existsSync(item.fixture), item.fixture);
    if (!sourceCache.has(item.target))
      sourceCache.set(item.target, readFileSync(item.target, 'utf8'));
    const source = sourceCache.get(item.target);
    const executableSource = source.slice(source.lastIndexOf('*/') + 2);
    assert.ok(
      new RegExp(`(?:fn|async fn)\\s+${item.test}\\b`).test(source) ||
        new RegExp(`declare_boundary_evidence_tests![\\s\\S]*\\b${item.test}\\b`).test(
          executableSource,
        ),
      `missing executable evidence test ${item.test}`,
    );
  }
  const materialBoundaryCount = parity.operations.reduce(
    (count, operation) => count + operation.boundaries.length,
    0,
  );
  assert.equal(
    parity.evidence_catalog.filter((item) => item.mode === 'response-conversion').length,
    materialBoundaryCount,
  );
  assert.equal(
    new Set(
      parity.evidence_catalog
        .filter(
          (item) =>
            item.mode === 'direct-http' &&
            !item.id.startsWith('http-fragment:') &&
            !item.id.startsWith('parity:runtime:'),
        )
        .map((item) => item.operation_key),
    ).size,
    parity.operations.length,
  );
  assert.equal(parity.http_parity.scenarios.length, parity.operations.length);
  assert.deepEqual(
    new Set(
      parity.evidence_catalog
        .filter((item) => item.mode === 'response-conversion')
        .map((item) => item.boundary_id),
    ),
    new Set(
      parity.operations.flatMap((operation) =>
        operation.boundaries.map((boundary) => boundary.boundary_id),
      ),
    ),
  );
});

test('schema-v2 direct-http coverage is operation-complete with promoted fragments', () => {
  const operationKeys = new Set(parity.operations.map((operation) => operation.key));
  const directRows = parity.evidence_catalog.filter((item) => item.mode === 'direct-http');
  assert.ok(directRows.length >= parity.operations.length);
  assert.deepEqual(
    new Set(
      directRows
        .filter((item) => operationKeys.has(item.operation_key))
        .map((item) => item.operation_key),
    ),
    operationKeys,
  );
  const expectedFragmentRows = [
    JSON.parse(
      readFileSync(
        'apps/api/tests/fixtures/api_contract/runtime-evidence-auth-research.json',
        'utf8',
      ),
    ).boundaries.length,
    JSON.parse(
      readFileSync(
        'apps/api/tests/fixtures/api_contract/runtime-evidence-market-stream.json',
        'utf8',
      ),
    ).entries.length,
  ].reduce((sum, count) => sum + count, 0);
  assert.equal(
    directRows.filter((item) => item.id.startsWith('http-fragment:')).length,
    expectedFragmentRows,
  );
  assert.deepEqual(parity.evidence_modes.sort(), ['direct-http', 'response-conversion']);
});

test('schema-v2 evidence rejects missing, duplicate, and mode-mismatched conversion rows', () => {
  const ops = parity.operations.map((row) => {
    const [method, ...path] = row.key.split(' ');
    return { method, path: path.join(' ') };
  });
  const mutated = structuredClone(parity);
  mutated.operations[0].boundaries[0].response_conversion_evidence = 'unknown';
  assert.throws(
    () => validateParity(mutated, ops, openapi),
    /evidence catalog set|response-conversion/,
  );

  const duplicate = structuredClone(parity);
  duplicate.evidence_catalog.find((item) => item.mode === 'response-conversion').boundary_id =
    duplicate.evidence_catalog.find((item) => item.mode === 'response-conversion').case_id +
    '-duplicate';
  assert.throws(() => validateParity(duplicate, ops, openapi), /response-conversion/);

  const unknown = structuredClone(parity);
  unknown.evidence_catalog.find((item) => item.mode === 'response-conversion').mode = 'unknown';
  assert.throws(
    () => validateParity(unknown, ops, openapi),
    /evidence catalog set|response-conversion/,
  );
});

test('schema-v2 evidence rows and response envelopes use exact closed key sets', () => {
  const ops = parity.operations.map((row) => {
    const [method, ...path] = row.key.split(' ');
    return { method, path: path.join(' ') };
  });
  for (const mutate of [
    (candidate) => {
      candidate.extra = true;
    },
    (candidate) => {
      candidate.evidence_catalog[0].extra = true;
    },
    (candidate) => {
      delete candidate.evidence_catalog[0].persisted_signature_id;
    },
    (candidate) => {
      candidate.evidence_catalog[0].expected_response.extra = true;
    },
    (candidate) => {
      delete candidate.evidence_catalog[0].expected_response.body_valid;
    },
    (candidate) => {
      candidate.evidence_catalog[0].effect_assertion.extra = 'none';
    },
  ]) {
    const mutated = structuredClone(parity);
    mutate(mutated);
    assert.throws(() => validateParity(mutated, ops, openapi), /incomplete contract coverage/);
  }
});

test('every emitted outcome field and effect is compared independently', () => {
  const row = parity.evidence_catalog.find((item) => item.mode === 'response-conversion');
  const expected = {
    ...row.expected_response,
    effect_assertion: row.effect_assertion,
  };
  assert.doesNotThrow(() => validateEvidenceOutcome(expected, expected, row.id));
  const mutations = {
    status: (value) => (value.status = 599),
    media_type: (value) => (value.media_type = 'text/plain'),
    security_mode: (value) => (value.security_mode = 'session'),
    header_names: (value) => (value.header_names = ['x-poison']),
    header_value_policies: (value) =>
      (value.header_value_policies = { 'x-poison': 'exact:poison' }),
    body_category: (value) => (value.body_category = 'poison'),
    body_valid: (value) => (value.body_valid = !value.body_valid),
    body_meaning: (value) => (value.body_meaning = 'poison'),
    durable: (value) => (value.effect_assertion.durable = 'user-created'),
    memory: (value) => (value.effect_assertion.memory = 'session-created'),
    cookie: (value) => (value.effect_assertion.cookie = 'set'),
    missing: (value) => delete value.body_valid,
    extra: (value) => (value.extra = true),
  };
  for (const [field, mutate] of Object.entries(mutations)) {
    const actual = structuredClone(expected);
    mutate(actual);
    assert.throws(
      () => validateEvidenceOutcome(actual, expected, `${row.id}:${field}`),
      /incomplete contract coverage/,
    );
  }
});

test('header policy, body validity, meaning, and effects are independently mutation-resistant', () => {
  const ops = parity.operations.map((row) => {
    const [method, ...path] = row.key.split(' ');
    return { method, path: path.join(' ') };
  });
  const conversion = parity.evidence_catalog.find(
    (item) => item.mode === 'response-conversion' && item.expected_response.header_names.length,
  );
  assert.ok(conversion, 'a meaningful-header conversion row is required');
  for (const mutate of [
    (value) => (value.header_names = ['x-poison']),
    (value) => (value.header_value_policies = { 'x-poison': 'exact:poison' }),
    (value) => (value.body_category = 'poison'),
    (value) => (value.body_valid = false),
    (value) => (value.body_meaning = 'poison'),
  ]) {
    const mutated = structuredClone(parity);
    const target = mutated.evidence_catalog.find((item) => item.id === conversion.id);
    mutate(target.expected_response);
    assert.throws(() => validateParity(mutated, ops, openapi), /incomplete contract coverage/);
  }
  for (const field of ['durable', 'memory', 'cookie']) {
    const mutated = structuredClone(parity);
    const target = mutated.evidence_catalog.find((item) => item.id === conversion.id);
    target.effect_assertion[field] = field === 'cookie' ? 'set' : `${field}-poison`;
    assert.throws(() => validateParity(mutated, ops, openapi), /incomplete contract coverage/);
  }
});

test('contract-meaningful headers use the closed deterministic value policies', () => {
  const policies = parity.evidence_catalog
    .filter((item) => item.mode === 'response-conversion')
    .map((item) => item.expected_response.header_value_policies);
  const values = (name) => policies.map((policy) => policy[name]).filter(Boolean);
  assert.ok(values('set-cookie').includes('set;secure;httponly;samesite=lax'));
  assert.ok(values('set-cookie').includes('clear;secure;httponly;samesite=lax'));
  assert.deepEqual(new Set(values('location')), new Set(['relative-or-https']));
  assert.deepEqual(new Set(values('retry-after')), new Set(['exact:30']));
  assert.deepEqual(new Set(values('cache-control')), new Set(['exact:no-cache']));
  assert.deepEqual(new Set(values('x-accel-buffering')), new Set(['exact:no']));
});
