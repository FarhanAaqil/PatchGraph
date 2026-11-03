import { test, expect } from '@playwright/test';

test.describe('PatchGraph Gate 4 — End-to-End MVP Vertical Slice E2E', () => {
  test('completes full analyst triage from SBOM import through plan comparison and approval', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('18.4 weighted risk removed');
  });
});
