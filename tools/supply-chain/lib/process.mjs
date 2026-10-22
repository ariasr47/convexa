import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

export function spawnCaptured(executable, argv = [], options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxOutput = options.maxOutputBytes ?? 1_048_576;
  return new Promise((resolve) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    let child;
    let timer;
    try {
      child = spawn(executable, argv, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      clearTimeout(timer);
      finish({
        state: 'blocked',
        raw_exit_code: null,
        output: '',
        raw_output_sha256: hash(Buffer.concat([stdout, stderr])),
      });
      return;
    }
    timer = setTimeout(() => {
      child.kill();
      finish({
        state: 'blocked',
        raw_exit_code: null,
        output: '',
        raw_output_sha256: hash(Buffer.concat([stdout, stderr])),
      });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxOutput)
        stdout = Buffer.concat([stdout, chunk.subarray(0, maxOutput - stdout.length)]);
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < maxOutput)
        stderr = Buffer.concat([stderr, chunk.subarray(0, maxOutput - stderr.length)]);
    });
    child.on('error', () => {
      clearTimeout(timer);
      finish({
        state: 'blocked',
        raw_exit_code: null,
        output: '',
        raw_output_sha256: hash(Buffer.concat([stdout, stderr])),
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const bytes = Buffer.concat([stdout, stderr]);
      finish({
        state: code === 0 ? 'pass' : 'fail',
        raw_exit_code: code,
        output: (options.outputStream === 'stderr' ? stderr : stdout).toString('utf8'),
        raw_output_sha256: hash(bytes),
      });
    });
  });
}
function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** The checked-out HEAD commit under `root`, or forty zeros when git cannot answer. */
export function gitSha(root) {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  return r.status === 0 && /^[a-f0-9]{40}$/.test(r.stdout.trim())
    ? r.stdout.trim()
    : '0'.repeat(40);
}
