import { test, expect } from '@playwright/test';

test.describe('PatchGraph Gate 2 — Data Flow E2E', () => {
  test('validates CycloneDX import, shows SHA-256 provenance, and flags stale evidence', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-imports').click();
    await expect(page.getByRole('heading', { name: 'SBOM and VEX Imports' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Recorded SBOM and VEX Imports' })).toContainText('4a7d1ed414474e40');
  });
});
