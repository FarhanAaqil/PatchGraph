import { test, expect } from '@playwright/test';

test.describe('PatchGraph Gate 5 — Decision Intelligence E2E', () => {
  test('displays VEX qualification and owner routing context', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('not_affected');
  });
});
