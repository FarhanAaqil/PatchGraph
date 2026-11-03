import { test, expect } from '@playwright/test';

test.describe('PatchGraph Gate 6 — System Ready E2E', () => {
  test('passes keyboard navigation and system status checks', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('active-snapshot-badge')).toBeVisible();
  });
});
