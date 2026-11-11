import { test, expect } from '@playwright/test';

// The interface must not reveal endpoint URLs, API tooling or the backend stack to the person using it.
const FORBIDDEN = /\/api\/|openapi|swagger|redoc|fastapi|api gateway|base url|endpoint/i;

test.describe('Interface does not expose the API', () => {
  test('no screen shows endpoint paths, API tooling or an API address setting', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('data-freshness-badge').first()).toBeVisible();

    const navIds = await page
      .locator('[data-testid^="nav-"]')
      .evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => el.getAttribute('data-testid') as string),
      );
    expect(navIds.length).toBeGreaterThan(3);

    for (const id of ['', ...navIds]) {
      if (id) {
        await page.getByTestId(id).first().click();
      }
      await page.waitForTimeout(600);
      const text = await page.locator('body').innerText();
      expect(text, `screen "${id || 'dashboard'}" mentions the API`).not.toMatch(FORBIDDEN);
    }
  });

  test('interactive API documentation is not published', async ({ request }) => {
    for (const path of ['/openapi.json', '/redoc']) {
      const res = await request.get(path);
      const body = await res.text();
      expect(body).not.toContain('"openapi"');
      expect(body.toLowerCase()).not.toContain('redoc');
    }
    const docs = await request.get('/docs');
    expect((await docs.text()).toLowerCase()).not.toContain('swagger');
  });
});
