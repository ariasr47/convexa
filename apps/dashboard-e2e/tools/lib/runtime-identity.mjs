import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
export function playwrightVersion() {
  return require('@playwright/test/package.json').version;
}
export function browserRevisions() {
  const browserFile = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../node_modules/playwright-core/browsers.json',
  );
  const browsers = require(browserFile);
  const entries = Object.fromEntries((browsers.browsers ?? []).map((entry) => [entry.name, entry]));
  return Object.fromEntries(
    ['chromium', 'firefox', 'webkit'].map((name) => [name, entries[name]?.revision ?? null]),
  );
}
export function runtimeIdentity() {
  return {
    playwright_version: playwrightVersion(),
    browser_revisions: browserRevisions(),
    host_platform: process.platform,
  };
}
