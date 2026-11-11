import path from 'node:path';
import { expect, test } from '@playwright/test';

const FIXTURES = path.resolve('tests/fixtures');

test.beforeEach(async ({ request }) => {
  await request.post('/api/v1/demo/load-sample');
});

test('import: upload an SBOM file, see it in the history, and get a clear error for bad JSON', async ({ page }) => {
  await page.goto('/import');
  await page.getByTestId('sbom-input').setInputFiles(path.join(FIXTURES, 'sbom_spdx_seed.json'));
  await expect(page.getByText(/components found/)).toBeVisible();
  await expect(page.getByTestId('import-history')).toContainText('sbom_spdx_seed.json');

  await page.getByRole('button', { name: /paste the JSON/ }).click();
  await page.getByLabel('Document').fill('{ not json');
  await page.getByRole('button', { name: 'Import pasted JSON' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/not valid JSON/);
});

test('import: a vendor statement (VEX) file is accepted', async ({ page }) => {
  await page.goto('/import');
  await page.getByTestId('vex-input').setInputFiles(path.join(FIXTURES, 'vex_openvex_seed.json'));
  await expect(page.getByText(/vex_openvex_seed.json imported|imported/).first()).toBeVisible();
});

test('map: diagram renders, the list view is available and selecting shows details', async ({ page }) => {
  await page.goto('/map');
  await expect(page.getByTestId('graph-canvas')).toBeVisible();
  await expect(page.locator('[data-testid=graph-canvas] canvas').first()).toBeVisible();

  await page.getByTestId('list-view').click();
  const table = page.getByTestId('node-table');
  await expect(table).toBeVisible();
  await table.getByRole('row').nth(1).click();
  await expect(page.getByTestId('node-panel')).toBeVisible();
});

test('settings: theme choice sticks across reloads and motion can be reduced', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByTestId('sources')).toContainText('OSV');
  await page.getByTestId('theme-ink').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ink');
  await page.getByTestId('motion-reduced').click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.getByTestId('theme-silver').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'silver');
});

test('quick jump: Ctrl+K opens, filters and navigates with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: 'Search commands' });
  await expect(box).toBeFocused();
  await box.fill('risks');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/risks$/);
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
});

test('old addresses still work', async ({ page }) => {
  await page.goto('/planner');
  await expect(page).toHaveURL(/\/plan$/);
  await page.goto('/audit');
  await expect(page).toHaveURL(/\/review/);
});

test('small screens: the menu opens as a slide-over and closes after choosing a page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByTestId('nav-risks').click();
  await expect(page).toHaveURL(/\/risks$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1); // no sideways scrolling
});
