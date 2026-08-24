import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const visual = fs.readFileSync('apps/dashboard-e2e/src/quality/visual.spec.ts', 'utf8');
const visualConfig = fs.readFileSync('apps/dashboard-e2e/playwright.visual.config.ts', 'utf8');
const shared = fs.readFileSync('apps/dashboard-e2e/playwright.shared.config.ts', 'utf8');
const compat = fs.readFileSync('apps/dashboard-e2e/src/quality/compatibility.spec.ts', 'utf8');
const a11y = fs.readFileSync('apps/dashboard-e2e/src/quality/accessibility.spec.ts', 'utf8');

test('visual capture owns the frame controller and fixed capture timestamp seam', () => {
  assert.match(visual, /installVisualFrameController/);
  assert.match(visual, /freezeVisualFrame/);
  assert.match(visual, /stabilizeVisualTop/);
  assert.ok(
    visual.indexOf('const topState = await stabilizeVisualTop') <
      visual.indexOf('await freezeVisualFrame'),
  );
  assert.match(visual, /pending: 0/);
  assert.match(
    fs.readFileSync('apps/dashboard-e2e/src/quality/fixtures/scenarios.ts', 'utf8'),
    /captureAt: FIXTURE_CAPTURE_AT/,
  );
});

test('visual Chromium uses deterministic software rendering', () => {
  assert.match(visualConfig, /launchOptions:\s*\{\s*args:\s*\['--disable-gpu'\]\s*\}/);
});

test('authorized visual updates use the Playwright 1.62 snapshot mode', () => {
  assert.match(visualConfig, /BROWSER_QUALITY_AUTHORIZED_UPDATE === '1' \? 'all' : 'none'/);
  assert.doesNotMatch(visualConfig, /BROWSER_QUALITY_AUTHORIZED_UPDATE === '1' \? true/);
});

test('non-visual specs and shared configuration do not install the visual controller', () => {
  assert.doesNotMatch(shared, /visual-frame/);
  assert.doesNotMatch(compat, /visual-frame/);
  assert.doesNotMatch(a11y, /visual-frame/);
});
