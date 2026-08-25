import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHILDREN, validateChildCatalog } from './lib/aggregate.mjs';
import { npmInvocation } from './lib/process.mjs';
import { ROOT } from './lib/repository-root.mjs';
import { hashFile, readSummary } from './lib/summary.mjs';

const QUALITY_SUMMARY_ROOT = path.join(ROOT, 'apps/dashboard-e2e/test-output/playwright');

export function validateChildEvidence({
  child,
  result,
  runId,
  source,
  root = ROOT,
  summaryReader = readSummary,
  hashReader = hashFile,
}) {
  const summaryPath = path.join(
    root,
    'apps/dashboard-e2e/test-output/playwright',
    child.gate,
    'summary.json',
  );
  const summaryPathRelative = path.relative(root, summaryPath).replaceAll(path.sep, '/');
  let summary;
  let summarySha;
  try {
    summary = summaryReader(summaryPath, { root });
    summarySha = hashReader(summaryPath);
  } catch (error) {
    console.error(
      `[quality] ${child.target} evidence invalid at ${summaryPathRelative}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      target: child.target,
      execution_key: `${runId}:${child.target}`,
      invocation_count: 1,
      exit_code: result.exit_code ?? 1,
      summary_path: summaryPathRelative,
      summary_sha256: null,
      status: 'incomplete',
    };
  }
  if (result.status === 'incomplete') {
    return {
      target: child.target,
      execution_key: `${runId}:${child.target}`,
      invocation_count: 1,
      exit_code: result.exit_code ?? 1,
      summary_path: summaryPathRelative,
      summary_sha256: summarySha,
      status: 'incomplete',
    };
  }
  const identityMatches =
    summary.gate === child.gate && summary.run_id === runId && summary.source_revision === source;
  const status =
    identityMatches && result.exit_code === 0 && summary.status === 'pass'
      ? 'pass'
      : summary.status === 'incomplete'
        ? 'incomplete'
        : 'fail';
  return {
    target: child.target,
    execution_key: `${runId}:${child.target}`,
    invocation_count: 1,
    exit_code: result.exit_code ?? 1,
    summary_path: summaryPathRelative,
    summary_sha256: summarySha,
    status,
  };
}

export function buildQualityReceipt({ runId, source, startedAt, completedAt, children }) {
  const status = children.every((child) => child.status === 'pass')
    ? 'pass'
    : children.some((child) => child.status === 'incomplete')
      ? 'incomplete'
      : 'fail';
  return {
    schema_version: 1,
    gate: 'quality',
    run_id: runId,
    source_revision: source,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    children,
  };
}

export function spawnQualityChildren({
  children = CHILDREN,
  spawnFn = spawn,
  platform = process.platform,
  execPath = process.execPath,
  npmCliPath = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  cwd = ROOT,
  env = process.env,
  runId = crypto.randomUUID(),
  source = '0'.repeat(40),
} = {}) {
  validateChildCatalog(children);
  const childEnv = { ...env };
  // Give each child Nx invocation its own tracker root; inheriting the aggregate root triggers
  // recursive-invocation detection when sibling webServer tasks start.
  delete childEnv.NX_INVOCATION_ROOT_PID;
  const invocation = npmInvocation({
    platform,
    execPath,
    npmCliPath,
    args: ['exec', '--', 'nx', 'run'],
  });
  return children.map(({ target, port }) => {
    const workspaceDataKey = crypto
      .createHash('sha256')
      .update(`${runId}\0${target}`)
      .digest('hex');
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve({ target, port, invocation_count: 1, ...result });
      };
      let child;
      try {
        child = spawnFn(invocation.command, [...invocation.args, target, '--skip-nx-cache'], {
          cwd,
          shell: false,
          stdio: 'inherit',
          env: {
            ...childEnv,
            NX_DAEMON: 'false',
            NX_WORKSPACE_DATA_DIRECTORY: path.join(
              cwd,
              '.nx',
              'workspace-data',
              'browser-quality',
              workspaceDataKey,
            ),
            BROWSER_QUALITY_RUN_ID: runId,
            BROWSER_QUALITY_SOURCE_REVISION: source,
            BROWSER_QUALITY_PORT: String(port),
            BROWSER_QUALITY_WORKERS: '1',
          },
        });
      } catch (error) {
        finish({ exit_code: 1, status: 'incomplete', error: error.message });
        return;
      }
      child.once('error', (error) =>
        finish({ exit_code: 1, status: 'incomplete', error: error.message }),
      );
      child.once('close', (code) =>
        finish({ exit_code: code ?? 1, status: code === 0 ? 'pass' : 'fail', error: null }),
      );
    });
  });
}

export async function runQuality({ spawnOptions = {} } = {}) {
  const startedAt = new Date().toISOString();
  const runId = process.env.BROWSER_QUALITY_RUN_ID ?? crypto.randomUUID();
  const source =
    process.env.BROWSER_QUALITY_SOURCE_REVISION ??
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const children = spawnQualityChildren({ ...spawnOptions, runId, source });
  const results = await Promise.allSettled(children);
  const childResults = results.map((result, index) =>
    result.status === 'fulfilled'
      ? validateChildEvidence({ child: CHILDREN[index], result: result.value, runId, source })
      : validateChildEvidence({
          child: CHILDREN[index],
          result: { exit_code: 1 },
          runId,
          source,
          summaryReader: () => {
            throw result.reason;
          },
        }),
  );
  const output = path.join(QUALITY_SUMMARY_ROOT, 'quality');
  fs.mkdirSync(output, { recursive: true });
  const completedAt = new Date().toISOString();
  const receipt = buildQualityReceipt({
    runId,
    source,
    startedAt,
    completedAt,
    children: childResults,
  });
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt.status === 'pass' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) {
    console.error('browser quality aggregate accepts no arguments');
    process.exit(2);
  }
  const exitCode = await runQuality();
  process.exitCode = exitCode;
}
