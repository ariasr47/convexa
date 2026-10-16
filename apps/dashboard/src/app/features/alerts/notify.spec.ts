// Whether a firing becomes a browser notification. Wrong here is silent: a notification after the
// reader pressed "Turn off", or a control that says "on" in a browser that can never show one.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetNotifyBroken,
  currentNotifyPermission,
  deliverBrowser,
  shouldNotify,
} from './useAlerts';

afterEach(() => {
  vi.unstubAllGlobals();
  __resetNotifyBroken();
});

describe('shouldNotify: the page flag is the master switch (W1-14)', () => {
  it('page off: nothing notifies, even a rule saved with its switch on', () => {
    expect(shouldNotify({ notify: true }, false)).toBe(false);
  });
  it('page on: a rule with its switch off stays quiet', () => {
    expect(shouldNotify({ notify: false }, true)).toBe(false);
  });
  it('page on: a rule saved before rules had a switch follows the page', () => {
    expect(shouldNotify({}, true)).toBe(true);
    expect(shouldNotify({ notify: true }, true)).toBe(true);
  });
});

describe('deliverBrowser', () => {
  it('a browser that refuses the constructor reads unavailable, not on (W1-18)', () => {
    class AndroidNotification {
      static permission: NotificationPermission = 'granted';
      constructor() {
        throw new TypeError(
          'Illegal constructor. Use ServiceWorkerRegistration.showNotification()',
        );
      }
    }
    vi.stubGlobal('Notification', AndroidNotification);
    expect(currentNotifyPermission()).toBe('granted');
    deliverBrowser('Convexa · NVDA', 'NVDA filed a 8-K', 'ev_1');
    expect(currentNotifyPermission()).toBe('unavailable');
  });
  it('tags each notification by its firing, so two in one check both show (W1-51)', () => {
    const tags: string[] = [];
    class DesktopNotification {
      static permission: NotificationPermission = 'granted';
      constructor(_title: string, options: NotificationOptions) {
        tags.push(options.tag ?? '');
      }
    }
    vi.stubGlobal('Notification', DesktopNotification);
    deliverBrowser('Convexa · NVDA', 'NVDA filed a 10-Q', 'ev_1_ar_x_0');
    deliverBrowser('Convexa · NVDA', 'NVDA filed a 8-K', 'ev_1_ar_x_1');
    expect(new Set(tags).size).toBe(2);
  });
});
