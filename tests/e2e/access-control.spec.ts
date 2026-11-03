import { test, expect } from '@playwright/test';

test.describe('PatchGraph Day 37 — Access Control E2E', () => {
  test('enforces read-only state for viewer role', async ({ page }) => {
    await page.goto('/');
    await page.locator('#state-switcher').selectOption('unauthorized');
    await expect(page.getByTestId('global-state-banner')).toContainText('[UNAUTHORIZED]');
  });
});
