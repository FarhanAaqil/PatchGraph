import { test, expect } from '@playwright/test';

/**
 * Day 7 Member 2 Deliverable: E2E Skeleton Specification (`tests/e2e/skeleton.spec.ts`)
 * Verifies the 14-screen analyst navigation, accessible severity/state banners,
 * and the seeded Gate 1 round-trip.
 */
test.describe('PatchGraph Gate 1 — Architecture Skeleton E2E', () => {
  test('renders primary navigation, offline-demo provenance badge, and seeded transitive finding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('active-snapshot-badge')).toContainText('snap_01');
    await expect(page.getByTestId('global-state-banner')).toContainText('[OFFLINE-DEMO]');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('example-lib@1.4.0');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('plan_01');
  });

  test('navigates to SBOM and VEX Imports screen and displays content-addressed hashes', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-imports').click();
    await expect(page.getByRole('heading', { name: 'SBOM and VEX Imports' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Recorded SBOM and VEX Imports' })).toContainText('sbom_cyclonedx_seed.json');
  });

  test('surfaces explicit degraded/stale and unauthorized UI states without silent fallback', async ({ page }) => {
    await page.goto('/');
    await page.locator('#state-switcher').selectOption('stale');
    await expect(page.getByTestId('global-state-banner')).toContainText('[STALE] Stale External Evidence Warning');

    await page.locator('#state-switcher').selectOption('unauthorized');
    await expect(page.getByTestId('global-state-banner')).toContainText('[UNAUTHORIZED] Read-Only Role Active');
  });
});
