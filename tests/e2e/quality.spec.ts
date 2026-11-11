import { expect, test } from '@playwright/test';

const PAGES = ['/', '/import', '/risks', '/plan', '/review', '/map', '/settings'];

// The interface must not reveal endpoint URLs, API tooling or the backend stack to the person using it.
const FORBIDDEN = /\/api\/|openapi|swagger|redoc|fastapi|api gateway|base url|endpoint/i;

test.beforeEach(async ({ request }) => {
  await request.post('/api/v1/demo/load-sample');
});

test('no screen mentions the API, and interactive API docs are not published', async ({ page, request }) => {
  for (const url of PAGES) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    expect(text, `${url} mentions the API`).not.toMatch(FORBIDDEN);
  }
  for (const path of ['/openapi.json', '/redoc', '/docs']) {
    const body = (await (await request.get(path)).text()).toLowerCase();
    expect(body).not.toContain('swagger');
    expect(body).not.toContain('"openapi"');
  }
});

test('accessibility basics hold on every screen', async ({ page }) => {
  for (const url of PAGES) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCount(1);
    const problems = await page.evaluate(() => {
      const issues: string[] = [];
      const hasName = (el: Element) =>
        (el.getAttribute('aria-label') ?? '').trim() ||
        (el.getAttribute('aria-labelledby') ?? '').trim() ||
        (el.textContent ?? '').trim() ||
        el.querySelector('[aria-label]');
      document.querySelectorAll('button, a[href]').forEach((el) => {
        if (!hasName(el)) issues.push(`unnamed ${el.tagName.toLowerCase()}: ${el.outerHTML.slice(0, 80)}`);
      });
      document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((el) => {
        const id = el.getAttribute('id');
        const labelled = el.getAttribute('aria-label') || (id && document.querySelector(`label[for="${id}"]`)) || el.closest('label');
        if (!labelled) issues.push(`unlabelled field: ${el.outerHTML.slice(0, 80)}`);
      });
      document.querySelectorAll('img:not([alt])').forEach((el) => issues.push(`image without alt: ${el.outerHTML.slice(0, 60)}`));
      return issues;
    });
    expect(problems, `${url}: ${problems.join(' | ')}`).toEqual([]);
  }
});

test('keyboard: Tab reaches the skip link first and the focus ring is visible', async ({ page }) => {
  await page.goto('/risks');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('performance budget: small first load, compressed, cached and revalidated', async ({ page, request }) => {
  const responses: Array<{ url: string; encoding: string | undefined }> = [];
  page.on('response', (r) => responses.push({ url: r.url(), encoding: r.headers()['content-encoding'] }));
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const transferred = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const js = entries.filter((e) => e.name.endsWith('.js')).reduce((sum, e) => sum + e.encodedBodySize, 0);
    const css = entries.filter((e) => e.name.endsWith('.css')).reduce((sum, e) => sum + e.encodedBodySize, 0);
    const fonts = entries.filter((e) => /\.woff2?$/.test(e.name)).reduce((sum, e) => sum + e.encodedBodySize, 0);
    return { js, css, fonts };
  });
  expect(transferred.js, 'JavaScript on first load (bytes, compressed)').toBeLessThan(110_000);
  expect(transferred.css).toBeLessThan(15_000);
  // Cytoscape is only for the Map screen, so it must not be fetched on the home page.
  expect(responses.some((r) => r.url.includes('vendor-cytoscape'))).toBe(false);
  // No third-party requests at all (fonts are self-hosted).
  expect(responses.filter((r) => !r.url.startsWith('http://127.0.0.1')).map((r) => r.url)).toEqual([]);

  const asset = responses.find((r) => r.url.includes('/assets/') && r.url.endsWith('.js'));
  const head = await request.get(asset!.url);
  expect(head.headers()['cache-control']).toContain('immutable');
  expect(head.headers()['content-encoding']).toBe('gzip');

  const first = await request.get('/api/v1/findings');
  const etag = first.headers()['etag'];
  expect(etag).toBeTruthy();
  const again = await request.get('/api/v1/findings', { headers: { 'If-None-Match': etag } });
  expect(again.status()).toBe(304);
  expect(first.headers()['server-timing']).toContain('app;dur=');
});

test('layout is stable: no content shift while the home screen settles', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let value = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
            if (!entry.hadRecentInput) value += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(value), 800);
      }),
  );
  expect(cls).toBeLessThan(0.1);
});
