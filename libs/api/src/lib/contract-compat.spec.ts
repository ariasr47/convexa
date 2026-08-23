import { describe, expect, it } from 'vitest';
import * as api from '../index';

describe('public API contract compatibility', () => {
  it('keeps the consumer-facing function and value exports available', () => {
    const required = [
      'getTicker',
      'streamTicker',
      'getSession',
      'signup',
      'login',
      'logout',
      'saveSettings',
      'getScan',
      'saveScanView',
      'requestRecommendation',
      'getBook',
      'putBook',
      'fetchTrackedContract',
      'fetchBrokerCredential',
      'putBrokerCredential',
      'deleteBrokerCredential',
      'fetchBrokerBook',
      'refreshBrokerBook',
      'ApiError',
      'AuthError',
    ];
    for (const name of required) expect(api).toHaveProperty(name);
  });
});
