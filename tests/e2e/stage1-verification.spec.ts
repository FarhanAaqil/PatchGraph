import { test, expect } from '@playwright/test';

test.describe('PatchGraph Stage 1 — End-to-End Operational Verification', () => {
  test('exercises full browser flow: Load Sample Data -> Ranked Findings -> Graph -> CP-SAT Plan -> Compare Two Plans -> Approve -> Audit Ledger', async ({ page }) => {
    // 1. Visit Ingest Page & Trigger "Load Sample Data"
    await page.goto('http://127.0.0.1:5000/');
    await expect(page.getByTestId('data-freshness-badge').first()).toBeVisible();

    await page.getByTestId('nav-imports').click();
    await page.waitForTimeout(500);

    const loadSampleBtn = page.getByTestId('load-sample-data-btn');
    await expect(loadSampleBtn).toBeVisible();
    await loadSampleBtn.click();

    // Verify sample data load success
    await expect(page.getByText(/Sample Data Loaded/i)).toBeVisible({ timeout: 10000 });

    // 2. Risk Page: Prioritized findings with ML factor contributions
    await page.getByTestId('nav-prioritization').click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('CVE-2026-1001').first()).toBeVisible();
    await expect(page.getByText('example-lib').first()).toBeVisible();

    // Click Explain button to inspect explainability slide-over drawer
    const explainBtn = page.getByRole('button', { name: /Explain/i }).first();
    await expect(explainBtn).toBeVisible();
    await explainBtn.click();
    await page.waitForTimeout(800);

    await expect(page.getByText('Risk Factor Breakdown')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Calibration Formula')).toBeVisible();
    await expect(page.getByText('Factor Contributions')).toBeVisible();

    // Close the drawer
    await page.getByTestId('close-explain-drawer').click();
    await page.waitForTimeout(500);

    // 3. Graph View: Cytoscape supply chain topology & nodes
    await page.getByTestId('nav-dependency-graph').click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Dependency & Deployment Graph')).toBeVisible();
    await expect(page.getByText('Topology Analysis')).toBeVisible();

    // 4. Planner Page: Solve CP-SAT remediation plan
    await page.getByTestId('nav-remediation-planner').click();
    await page.waitForTimeout(800);

    const optimizeBtn = page.getByRole('button', { name: /Run CP-SAT Optimizer/i });
    await expect(optimizeBtn).toBeVisible();
    await optimizeBtn.click();

    // Verify optimal plan generated
    await expect(page.getByText('PROVABLY OPTIMAL', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Recommended Action Sequence')).toBeVisible();

    // 5. Compare Two Plans
    const compareBtn = page.getByTestId('compare-plans-btn');
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // Verify side-by-side comparison view
    await expect(page.getByTestId('plan-comparison-view')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Side-by-Side Plan Comparison')).toBeVisible();
    await expect(page.getByText(/Plan A: Baseline/i)).toBeVisible();
    await expect(page.getByText(/Plan B: Expanded/i)).toBeVisible();
    await expect(page.getByText(/Comparison Deltas/i)).toBeVisible();

    // 6. Navigate to Audit & Review and execute Human Approval Gate
    await page.getByTestId('nav-audit').click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('Human Decision Gate')).toBeVisible();
    await expect(page.getByText('Immutable Audit Ledger')).toBeVisible();

    // Fill human review comment
    const commentInput = page.getByPlaceholder(/Enter required justification/i);
    await expect(commentInput).toBeVisible();
    await commentInput.fill('Verified backward compatibility and dependency tree in staging. Approved for deployment.');

    const approveBtn = page.getByRole('button', { name: /Approve Plan/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify success banner and immutable audit ledger record
    await expect(page.getByText(/Decision 'APPROVED' committed to immutable audit entry/i)).toBeVisible({ timeout: 8000 });

    // 7. Verify Offline mode concept is removed and data freshness is present
    await expect(page.getByTestId('data-freshness-badge').first()).toContainText('snap_01');
    const bodyText = await page.innerText('body');
    expect(bodyText.includes('[OFFLINE-DEMO]')).toBeFalsy();
    expect(bodyText.includes('offline-demo')).toBeFalsy();
  });
});
