import { sharedConfig } from './playwright.shared.config';
export default {
  ...sharedConfig('visual'),
  testDir: './src/quality',
  testMatch: ['visual.spec.ts'],
  retries: 0,
  updateSnapshots: process.env.BROWSER_QUALITY_AUTHORIZED_UPDATE === '1' ? true : 'none',
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
