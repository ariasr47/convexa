import { sharedConfig } from './playwright.shared.config';

const config = sharedConfig('visual');
export default {
  ...config,
  use: {
    ...config.use,
    launchOptions: { args: ['--disable-gpu'] },
  },
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
