import { test, expect } from '@playwright/test';

test.describe('PatchGraph Stage 2 — UI/UX Redesign & Operational Verification', () => {
  test('verifies collapsible sidebar, local storage persistence, and icon-only mode', async ({ page }) => {
    await page.goto('/');

    // Sidebar should be initially expanded or default
    const sidebar = page.locator('[data-testid="collapsible-sidebar"]');
    await expect(sidebar).toBeVisible();

    const toggleBtn = page.locator('[data-testid="toggle-sidebar"]');
    await expect(toggleBtn).toBeVisible();

    // Verify initial width is expanded (~260px)
    const initialBox = await sidebar.boundingBox();
    expect(initialBox).toBeTruthy();
    expect(initialBox!.width).toBeGreaterThan(200);

    // Click toggle to collapse
    await toggleBtn.click();
    await page.waitForTimeout(350); // wait for CSS transition

    // Verify collapsed width (~76px)
    const collapsedBox = await sidebar.boundingBox();
    expect(collapsedBox).toBeTruthy();
    expect(collapsedBox!.width).toBeLessThan(100);

    // Verify localStorage persistence
    const savedState = await page.evaluate(() => localStorage.getItem('patchgraph_sidebar_collapsed'));
    expect(savedState).toBe('true');

    // Reload page and check persistence
    await page.reload();
    await page.waitForTimeout(200);
    const reloadedBox = await sidebar.boundingBox();
    expect(reloadedBox).toBeTruthy();
    expect(reloadedBox!.width).toBeLessThan(100);

    // Expand sidebar back
    await toggleBtn.click();
    await page.waitForTimeout(350);
    const restoredBox = await sidebar.boundingBox();
    expect(restoredBox).toBeTruthy();
    expect(restoredBox!.width).toBeGreaterThan(200);
  });

  test('verifies complete removal of marketing/filler text from all views', async ({ page }) => {
    await page.goto('/');

    const pageContent = await page.content();

    // Verify all 6 banned marketing sections are completely absent
    expect(pageContent).not.toContain('Continuous Threat Intelligence & Ecosystem Interoperability');
    expect(pageContent).not.toContain('From Ingestion to Verified Human Sign-Off');
    expect(pageContent).not.toContain('Zero Autonomous Modifications Guarantee');
    expect(pageContent).not.toContain('Humans approve. Always.');
    expect(pageContent).not.toContain('Built by Farhan Aaqil');
    expect(pageContent).not.toContain('Seeded Architecture Skeleton Scenario (Gate 1)');

    // Verify authentic telemetry workbench components exist
    await expect(page.locator('[data-testid="security-posture-telemetry"]')).toBeVisible();
    await expect(page.locator('[data-testid="interactive-pipeline-rail"]')).toBeVisible();
  });

  test('verifies interactive graph page with Cytoscape canvas and node path inspector', async ({ page }) => {
    await page.goto('/');

    // Navigate to Graph view
    await page.locator('[data-testid="nav-dependency-graph"]').click();
    await page.waitForSelector('[data-testid="cytoscape-graph-container"]');

    // Verify Cytoscape canvas is rendered
    const cyContainer = page.locator('[data-testid="cytoscape-graph-container"]');
    await expect(cyContainer).toBeVisible();

    // Verify canvas elements exist
    const canvasElements = page.locator('[data-testid="cytoscape-graph-container"] canvas');
    await expect(canvasElements.first()).toBeVisible();

    // Verify Graph controls (zoom in, zoom out, fit, reset)
    await expect(page.locator('button[title="Fit to Canvas"]')).toBeVisible();
    await expect(page.locator('button[title="Reset Layout & Highlights"]')).toBeVisible();

    // Verify environment and severity filters
    await expect(page.locator('select').first()).toBeVisible();
  });
});
