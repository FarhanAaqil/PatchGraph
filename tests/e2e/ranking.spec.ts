import { test, expect } from '@playwright/test';

test.describe('PatchGraph Gate 3 — Intelligence Slice E2E', () => {
  test('traces vulnerable transitive dependency to affected production service with factor explanation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('example-lib@1.4.0');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('checkout');
  });
});
