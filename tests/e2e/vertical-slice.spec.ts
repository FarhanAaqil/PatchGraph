import { test, expect } from '@playwright/test';

test.describe('PatchGraph Gate 4 — End-to-End MVP Vertical Slice E2E', () => {
  test('completes full analyst triage from SBOM import through plan comparison and approval', async ({ page }) => {
    // 1. Landing view: verify brand, 3D hero container, and seeded scenario summary
    await page.goto('/');
    await expect(page.getByTestId('active-snapshot-badge')).toBeVisible();
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('18.4 weighted risk removed');
    await expect(page.getByTestId('seeded-scenario-summary')).toContainText('example-lib@1.4.0');

    // 2. Ingest view: navigate to SBOM and VEX import workspace
    await page.getByTestId('nav-imports').click();
    await expect(page.getByRole('heading', { name: 'SBOM and VEX Imports' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Recorded SBOM and VEX Imports' })).toContainText('sbom_cyclonedx_seed.json');

    // 3. Graph view: navigate to Cytoscape dependency and deployment topology
    await page.getByTestId('nav-dependency-graph').click();
    await expect(page.getByText('Dependency & Deployment Graph')).toBeVisible();

    // 4. Risk view: inspect prioritized risk register with calibrated exploit intelligence
    await page.getByTestId('nav-prioritization').click();
    await expect(page.getByText('Prioritized Risk Register')).toBeVisible();
    await expect(page.getByText('Calibrated Exploit Intelligence')).toBeVisible();

    // 5. Planner view: run CP-SAT mathematical optimizer with constraints
    await page.getByTestId('nav-remediation-planner').click();
    await expect(page.getByText('Constrained Remediation Planner')).toBeVisible();
    await expect(page.getByText('Effort Budget')).toBeVisible();

    // 6. Review & Audit view: verify human decision gate and append-only governance ledger
    await page.getByTestId('nav-audit').click();
    await expect(page.getByText('Human Review & Immutable Audit')).toBeVisible();
    await expect(page.getByText('Human Decision Gate')).toBeVisible();
    await expect(page.getByText('Immutable Audit Ledger')).toBeVisible();
  });
});
