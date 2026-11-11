import { expect, test } from '@playwright/test';

// The core job of the product, end to end: import → see what matters → plan → approve → proof in the log.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  const res = await request.post('/api/v1/demo/load-sample');
  expect(res.ok()).toBeTruthy();
});

test('home guides a new person to the next step', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const next = page.getByTestId('next-step');
  await expect(next).toBeVisible();
  await expect(next.getByRole('button')).toBeVisible();
  await expect(page.getByText('Open findings')).toBeVisible();
});

test('risks: search, filter, explain in plain language, and keyboard focus returns', async ({ page }) => {
  await page.goto('/risks');
  const rows = page.getByTestId('finding-row');
  await expect(rows.first()).toBeVisible();
  const all = await rows.count();
  expect(all).toBeGreaterThan(0);

  // Debounced search narrows the list and the URL keeps the state.
  await page.getByTestId('risk-search').fill('zzz-no-match');
  await expect(page.getByText('No findings match')).toBeVisible();
  await expect(page).toHaveURL(/q=zzz-no-match/);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(rows.first()).toBeVisible();

  await page.getByTestId('kev-toggle').click();
  await expect(page.getByTestId('kev-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('kev-toggle').click();

  // Explain drawer: plain language, factor bars, Escape closes, focus goes back to the row button.
  const opener = rows.first().getByRole('button');
  await opener.focus();
  await opener.press('Enter');
  const drawer = page.getByTestId('explain-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Why this matters')).toBeVisible();
  await expect(drawer.getByText('How the score is built')).toBeVisible();
  await expect(drawer.getByRole('meter').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
});

test('plan, compare, review and approve with a recorded reason', async ({ page }) => {
  await page.goto('/plan');
  await page.getByTestId('create-plan').click();
  const result = page.getByTestId('plan-result');
  await expect(result).toBeVisible();
  await expect(page.getByTestId('plan-actions')).toBeVisible();

  await page.getByTestId('compare-plans').click();
  await expect(page.getByTestId('comparison')).toBeVisible();

  await page.getByTestId('send-to-review').click();
  await expect(page).toHaveURL(/\/review\?plan=/);

  // A reason is mandatory: nothing is recorded without one.
  const before = await page.request.get('/api/v1/audit?limit=1').then((r) => r.json());
  await page.getByTestId('approve').click();
  await expect(page.getByText(/at least 3 characters/)).toBeVisible();
  const unchanged = await page.request.get('/api/v1/audit?limit=1').then((r) => r.json());
  expect(unchanged.total).toBe(before.total);

  await page.getByTestId('reason').fill('Checked compatibility in staging; approved for the next window.');
  await page.getByTestId('approve').click();
  await expect(page.getByText(/Decision saved as audit entry/)).toBeVisible();
  await expect(page.getByTestId('decision-card').getByText('Approved', { exact: true })).toBeVisible();
  await expect(page.getByTestId('audit-table')).toContainText('Plan decision approved');

  await page.goto('/');
  await expect(page.getByText('Plans approved')).toBeVisible();
});

test('an impossible plan explains itself instead of failing silently', async ({ page }) => {
  await page.goto('/plan');
  await page.getByTestId('budget').fill('2');
  await page.getByTestId('downtime').fill('0');
  await page.getByTestId('create-plan').click();
  await expect(page.getByRole('alert')).toContainText(/No fixes fit/);
});
