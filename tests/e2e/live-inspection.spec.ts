import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('PatchGraph Complete Live Inspection & Verification', () => {
  const screenshotsDir = path.resolve('docs/live_screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('walks through entire production system on Chromium, capturing visual evidence', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Landing & 3D Interactive Hero
    await page.goto('http://127.0.0.1:5000/');
    await expect(page.getByTestId('data-freshness-badge').first()).toBeVisible();
    await expect(page.getByTestId('seeded-scenario-summary')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '01_overview_3d_hero.png'), fullPage: true });

    // 2. Ingestion Gateway & Drag-and-Drop Dropzone
    await page.getByTestId('nav-imports').click();
    await expect(page.getByText('Artifact & Topology Ingest')).toBeVisible();
    await expect(page.getByTestId('load-sample-data-btn')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '02_ingest_gateway.png'), fullPage: true });

    // Click Load Sample Data
    await page.getByTestId('load-sample-data-btn').click();
    await expect(page.getByText(/Sample Data Loaded/i)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, '03_sample_data_loaded.png'), fullPage: true });

    // 3. Risk Intelligence & ML Explainability
    await page.getByTestId('nav-prioritization').click();
    await expect(page.getByText('Prioritized Risk Register')).toBeVisible();
    await expect(page.getByText('CVE-2026-1001').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '04_risk_register.png'), fullPage: true });

    // Open Explain Drawer
    const explainBtn = page.getByRole('button', { name: /Explain/i }).first();
    await explainBtn.click();
    await expect(page.getByText('Risk Factor Breakdown')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Log-Odds Feature Contributions')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '05_ml_explain_drawer.png'), fullPage: true });
    await page.getByTestId('close-explain-drawer').click();
    await expect(page.getByTestId('close-explain-drawer')).toBeHidden();

    // 4. Interactive Cytoscape Graph & Path Inspection
    await page.getByTestId('nav-dependency-graph').click();
    await expect(page.getByText('Dependency & Deployment Graph')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '06_interactive_graph.png'), fullPage: true });

    // 5. CP-SAT Remediation Optimizer
    await page.getByTestId('nav-remediation-planner').click();
    await expect(page.getByText('Constrained Remediation Planner')).toBeVisible();
    const runOptimizerBtn = page.getByRole('button', { name: /Run CP-SAT Optimizer/i });
    await runOptimizerBtn.click();
    await expect(page.getByText('PROVABLY OPTIMAL', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, '07_cpsat_plan_solved.png'), fullPage: true });

    // Compare Two Plans
    const compareBtn = page.getByTestId('compare-plans-btn');
    await compareBtn.click();
    await expect(page.getByTestId('plan-comparison-view')).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: path.join(screenshotsDir, '08_plan_comparison_view.png'), fullPage: true });

    // 6. Human Decision Gate & Immutable Audit Ledger
    await page.getByTestId('nav-audit').click();
    await expect(page.getByText('Human Decision Gate')).toBeVisible();
    await expect(page.getByText('Immutable Audit Ledger')).toBeVisible();

    const commentInput = page.getByPlaceholder(/Enter required justification/i);
    await commentInput.fill('Full end-to-end verification approved by SecOps lead.');
    await page.getByRole('button', { name: /Approve Plan/i }).click();
    await expect(page.getByText(/Decision 'APPROVED' committed to immutable audit entry/i)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: path.join(screenshotsDir, '09_audit_decision_approved.png'), fullPage: true });

    // 7. Assets Inventory
    await page.goto('http://127.0.0.1:5000/assets');
    await expect(page.getByText('Deployment Context & Asset Inventory')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '10_assets_inventory.png'), fullPage: true });

    // 8. Settings & Model Card Transparency
    await page.goto('http://127.0.0.1:5000/settings');
    await expect(page.getByText('Environment & Connector Settings')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '11_settings_and_model_card.png'), fullPage: true });

    console.log(`Captured 11 live verification screenshots in ${screenshotsDir}`);
    // Ensure no severe uncaught errors
    const fatalErrors = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('ResizeObserver'));
    expect(fatalErrors).toHaveLength(0);
  });
});
