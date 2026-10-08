import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fixture = readFileSync(
  new URL('../src/quality/fixtures/strict-fixture.ts', import.meta.url),
  'utf8',
);
const scenarios = readFileSync(
  new URL('../src/quality/fixtures/scenarios.ts', import.meta.url),
  'utf8',
);
const a11y = readFileSync(new URL('../src/quality/accessibility.spec.ts', import.meta.url), 'utf8');
const chromiumConfig = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8');

test('scanner fixture uses the application prices SSE envelope and keeps stream routes narrow', () => {
  assert.match(fixture, /url\.pathname === '\/api\/stream\/prices'/);
  assert.match(fixture, /prices:\s*\{/);
  assert.doesNotMatch(fixture, /url\.pathname\.startsWith\('\/api\/stream\/'\)/);
  assert.match(fixture, /assertScannerStreamPayload/);
  assert.match(fixture, /malformed Scanner SSE payload/);
});

test('malformed Scanner SSE payload is a readiness failure, not a product fallback', () => {
  assert.match(fixture, /missing prices envelope/);
  assert.match(fixture, /invalid quote/);
  assert.doesNotMatch(fixture, /catch\s*\{\s*return\s+payload/);
});

test('retained Chromium maps the quality port to both server and client URL', () => {
  assert.match(chromiumConfig, /const shared = sharedConfig\('chromium'\)/);
  assert.match(chromiumConfig, /\.\.\.shared,/);
  assert.match(chromiumConfig, /\.\.\.shared\.use,/);
  assert.doesNotMatch(chromiumConfig, /baseURL\s*[:,=]/);
});

test('book fixture does not present a newer empty server book', () => {
  assert.match(scenarios, /'GET \/api\/book': response\(\{ blob: \{\}, updated_at: 0 \}\)/);
  assert.match(scenarios, /fixture-position-\$\{i\}/);
  assert.match(scenarios, /\[0, 1, 2\]/);
});

test('anonymous behavioral arm is built from an anonymous scenario', () => {
  assert.doesNotMatch(a11y, /\{\.\.\.accessibilityScenarios\[4\], auth: 'anonymous'\}/);
  assert.match(a11y, /signed-out-auth-dialog/);
});

test('watchdog arm advances the full 15-second window before offline assertions', () => {
  assert.match(
    fixture,
    /const watchdogArm = scenario\.id === 'ticker-stream-loss' \|\| scenario\.id === 'A11Y-9'/,
  );
  assert.match(fixture, /await streamReady/);
  assert.match(fixture, /releaseInitialStream/);
  assert.match(fixture, /const current = await page\.evaluate\(\(\) => Date\.now\(\)\)/);
  assert.match(fixture, /page\.clock\.pauseAt\(new Date\(current \+ 60_000\)\)/);
  assert.doesNotMatch(fixture, /new Date\(Date\.parse\(scenario\.now\) \+ 1_000\)/);
  assert.match(
    readFileSync(new URL('../src/quality/compatibility.spec.ts', import.meta.url), 'utf8'),
    /requestState\.releaseInitialStream\(\)/,
  );
  assert.doesNotMatch(fixture, /new Date\(\)/);
  assert.match(a11y, /fastForward\(14_000\)/);
  assert.match(a11y, /fastForward\(1_000\)/);
});

test('scale and reflow arms are isolated and use CDP page scale', () => {
  assert.match(a11y, /newCDPSession/);
  assert.match(a11y, /Emulation\.setPageScaleFactor/);
  assert.doesNotMatch(a11y, /document\.documentElement\.style\.zoom/);
});

test('AI visual fixture declares the authenticated position-query ticker variant exactly', () => {
  assert.match(
    scenarios,
    /GET \/api\/ticker\/SPY\?pos_expiration=2026-09-18&pos_strike=500&pos_right=call&dark_pool=true/,
  );
  assert.match(
    fixture,
    /const key = `\$\{request\.method\(\)\} \$\{url\.pathname\}\$\{url\.search\}`/,
  );
  assert.doesNotMatch(fixture, /url\.search\.startsWith\(/);
});

test('strict fixture keeps undeclared ticker query variants blocked', () => {
  assert.match(fixture, /unexpected\.push\(key\)/);
  assert.doesNotMatch(
    scenarios,
    /GET \/api\/ticker\/SPY\?pos_expiration=2026-09-18&pos_strike=500&pos_right=put&dark_pool=true/,
  );
});
