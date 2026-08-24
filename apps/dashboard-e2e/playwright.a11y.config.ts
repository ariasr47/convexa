import { sharedConfig } from './playwright.shared.config';
export default {
  ...sharedConfig('accessibility'),
  testDir: './src/quality',
  testMatch: ['accessibility.spec.ts'],
} as any;
