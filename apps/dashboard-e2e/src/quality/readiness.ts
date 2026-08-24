import type { Page } from '@playwright/test';

export type Predicate = {
  selector: string;
  state?: 'visible' | 'hidden' | 'attached';
  count?: number;
  text?: string;
};

export async function assertReady(
  page: Page,
  record: { ready: readonly Predicate[]; forbidden: readonly Predicate[] },
) {
  if (!record.ready.length || !record.forbidden.length)
    throw new Error('readiness predicates must be non-empty');
  for (const predicate of record.ready) {
    const locator = page.locator(predicate.selector);
    if (predicate.count !== undefined) await locator.waitFor({ state: 'attached' });
    else if ((predicate.state ?? 'visible') === 'visible')
      await locator.first().waitFor({ state: 'visible' });
    else await locator.first().waitFor({ state: predicate.state ?? 'attached' });
    if (predicate.count !== undefined && (await locator.count()) !== predicate.count)
      throw new Error(`readiness count failed: ${predicate.selector}`);
    if (
      predicate.text !== undefined &&
      !(await locator.first().innerText()).includes(predicate.text)
    )
      throw new Error(`readiness text failed: ${predicate.selector}`);
  }
  for (const predicate of record.forbidden) {
    const locator = page.locator(predicate.selector);
    if ((await locator.count()) !== 0)
      throw new Error(`forbidden readiness predicate matched: ${predicate.selector}`);
  }
}
