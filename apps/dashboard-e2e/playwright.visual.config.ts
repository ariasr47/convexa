import { sharedConfig } from './playwright.shared.config';

const config = sharedConfig('visual');
export default {
  ...config,
  use: {
    ...config.use,
    // `--disable-lcd-text`: subpixel (LCD) text anti-aliasing varied between runs on the linux runner
    // (5 px on scanner-dense symbol cells, 2026-09-09); grayscale AA rasterises text deterministically.
    launchOptions: { args: ['--disable-gpu', '--disable-lcd-text'] },
  },
  testDir: './src/quality',
  testMatch: ['visual.spec.ts'],
  retries: 0,
  updateSnapshots: process.env.BROWSER_QUALITY_AUTHORIZED_UPDATE === '1' ? 'all' : 'none',
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      threshold: 0,
      maxDiffPixels: 0,
      maxDiffPixelRatio: 0,
    },
  },
} as any;
