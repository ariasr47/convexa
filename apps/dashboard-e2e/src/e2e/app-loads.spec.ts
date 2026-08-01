import { expect, test } from '@playwright/test';

// Trivial smoke e2e — proves the app shell boots and the e2e target is real. Feature e2e flows are
// deferred to nearer go-live per the testing rule. No backend is required: the Convexa AppBar renders
// client-side before any data loads (the dashboard below it just shows a loading state).
//
// Ported from app-loads.cy.ts (2026-07-28). `cy.contains('Convexa').should('be.visible')` becomes a
// visibility expectation on the first match — Playwright's `getByText` is strict about multiple
// matches, and the wordmark appears in both the AppBar and the footer, so `.first()` preserves the
// Cypress semantics exactly rather than tightening them by accident.
test.describe('app shell', () => {
  test('loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Convexa').first()).toBeVisible();
  });
});
