import { test, expect } from '@playwright/test';

// Trivial smoke e2e — proves the app shell boots and the e2e target is real. Feature e2e flows are
// deferred to nearer go-live per the testing rule. No backend is required: the Convexa AppBar
// renders client-side before any data loads (the dashboard below it just shows a loading state).
test('app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Convexa')).toBeVisible();
});
