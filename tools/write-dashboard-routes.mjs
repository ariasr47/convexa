#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.env.VITE_DATA_MODE ?? 'live';
if (mode !== 'demo' && mode !== 'live') throw new Error(`Invalid VITE_DATA_MODE: ${mode}`);
export function writeRoutes(dist, dataMode) {
  mkdirSync(dist, { recursive: true });
  const routes = dataMode === 'demo'
    ? { version: 1, include: ['/*'], exclude: ['/*'] }
    : { version: 1, include: ['/api/*'], exclude: [] };
  writeFileSync(path.join(dist, '_routes.json'), `${JSON.stringify(routes, null, 2)}\n`);
  writeFileSync(path.join(dist, 'demo-mode.json'), `${JSON.stringify({ mode: dataMode, scenarioId: dataMode === 'demo' ? 'portfolio-2026-10-07-v1' : null }, null, 2)}\n`);
}
const dist = path.join(root, 'apps', 'dashboard', 'dist');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeRoutes(dist, mode);
  console.log(`[dashboard-routes] wrote ${mode} Pages routing`);
}
