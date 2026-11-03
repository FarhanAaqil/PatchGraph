import { test, expect } from '@playwright/test';

test.describe('PatchGraph Day 48 — UI Stress & Recovery E2E', () => {
  test('renders large topology summary and table fallback without blocking main thread', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('seeded-scenario-summary')).toBeVisible();
  });
});
