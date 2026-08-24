import { spawn } from 'node:child_process';
import path from 'node:path';

export function npmInvocation({
  platform = process.platform,
  execPath = process.execPath,
  npmCliPath = null,
  args = [],
} = {}) {
  if (platform === 'win32') {
    if (!npmCliPath || !path.isAbsolute(npmCliPath)) {
      throw new Error('Windows npm CLI path must be absolute and present');
    }
    return { command: execPath, args: [npmCliPath, ...args], shell: false };
  }
  return { command: 'npm', args: [...args], shell: false };
}

export function spawnCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false });
    let error;
    child.once('error', (value) => {
      error = value;
    });
    child.once('close', (code) => resolve({ exit_code: code ?? 1, error: error?.message ?? null }));
  });
}
