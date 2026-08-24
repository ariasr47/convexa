import { sharedConfig } from './playwright.shared.config';
export default {
  ...sharedConfig('compatibility'),
  testDir: './src/quality',
  testMatch: ['compatibility.spec.ts'],
} as any;
