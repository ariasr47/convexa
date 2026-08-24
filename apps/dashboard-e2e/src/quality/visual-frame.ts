import type { Page } from '@playwright/test';
import type { Scenario } from './fixtures/scenarios';

export function visualFrameController() {
  const pending = new Set<number>();
  let frozen = false;
  const nativeRequest = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    if (frozen) return 0;
    let id = 0;
    id = nativeRequest((timestamp) => {
      pending.delete(id);
      callback(timestamp);
    });
    pending.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    nativeCancel(id);
  };
  (window as unknown as { __qualityFreezeVisualFrame: () => void }).__qualityFreezeVisualFrame =
    () => {
      frozen = true;
      for (const id of pending) nativeCancel(id);
      pending.clear();
    };
  (
    window as unknown as { __qualityVisualFrameState: () => { frozen: boolean; pending: number } }
  ).__qualityVisualFrameState = () => ({ frozen, pending: pending.size });
}

export async function installVisualFrameController(page: Page) {
  await page.addInitScript({ content: `(${visualFrameController.toString()})();` });
}

export async function freezeVisualFrame(page: Page, scenario: Scenario) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())),
  );
  await page.clock.pauseAt(new Date(scenario.captureAt));
  await page.evaluate(() => {
    const freeze = (window as unknown as { __qualityFreezeVisualFrame?: () => void })
      .__qualityFreezeVisualFrame;
    if (!freeze) throw new Error('visual frame controller was not installed');
    freeze();
  });
}

export async function stabilizeVisualTop(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(
    () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())),
  );
  const state = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="top-nav"]');
    if (!nav) throw new Error('visual top-nav is missing');
    const rect = nav.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      top: rect.top,
      height: rect.height,
      position: getComputedStyle(nav).position,
    };
  });
  if (state.scrollY !== 0 || state.top !== 0 || state.position !== 'sticky') {
    throw new Error(`visual top-nav is not stable at the top: ${JSON.stringify(state)}`);
  }
  return state;
}
