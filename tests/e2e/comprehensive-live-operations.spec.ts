import { test, expect } from '@playwright/test';

test.describe('Exhaustive Live Operations Test Suite', () => {
  test('exercises and verifies every single user operation across all pages', async ({ page }) => {
    test.setTimeout(90000);

    // Collect all console errors to verify clean runtime
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('ResizeObserver')) {
          errors.push(text);
        }
      }
    });

    // ==========================================
    // OPERATION 1: OVERVIEW & 3D HERO CANVAS
    // ==========================================
    await page.goto('http://127.0.0.1:5000/');
    await expect(page.getByTestId('data-freshness-badge').first()).toBeVisible();
    await expect(page.getByText('Patch what matters.')).toBeVisible();

    // Verify Three.js canvas initialized
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Verify 5-Step Pipeline Rail
    await expect(page.getByTestId('interactive-pipeline-rail')).toBeVisible();
    await expect(page.getByText('Five-Stage Remediation Architecture')).toBeVisible();
    await expect(page.getByText('01', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('05', { exact: true }).first()).toBeVisible();

    // ==========================================
    // OPERATION 2: COMMAND PALETTE (CTRL/CMD+K)
    // ==========================================
    await page.getByTitle('Quick Search (Ctrl/Cmd+K)').click();
    const searchInput = page.getByPlaceholder('Search commands, CVEs, packages, services...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('CVE-2026-1001');
    await expect(page.getByText('CVE-2026-1001 (example-lib @ 1.4.0 — Score 10.57)')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(searchInput).toBeHidden();

    // ==========================================
    // OPERATION 3: SIDEBAR COLLAPSE & EXPAND
    // ==========================================
    const sidebar = page.getByTestId('collapsible-sidebar');
    const toggleBtn = page.getByTitle(/Collapse sidebar|Expand sidebar/i);
    await toggleBtn.click();
    await expect(sidebar).toHaveCSS('width', '76px');
    await toggleBtn.click();
    await expect(sidebar).toHaveCSS('width', '260px');

    // ==========================================
    // OPERATION 4: INGESTION GATEWAY & UPLOADS
    // ==========================================
    await page.getByTestId('nav-imports').click();
    await expect(page.getByText('Artifact & Topology Ingest')).toBeVisible();

    // Test format tab switching with exact: true
    await page.getByRole('button', { name: 'OpenVEX', exact: true }).click();
    await expect(page.getByText('Drag & Drop VEX File')).toBeVisible();
    await page.getByRole('button', { name: 'Topology', exact: true }).click();
    await expect(page.getByText('Drag & Drop TOPOLOGY File')).toBeVisible();
    await page.getByRole('button', { name: 'CycloneDX / SPDX', exact: true }).click();

    // Test simulated uploads
    const sampleIngestBtn = page.getByRole('button', { name: /Ingest Sample CycloneDX/i });
    await sampleIngestBtn.click();
    await expect(page.getByText(/Ingestion Successful!/i)).toBeVisible({ timeout: 10000 });

    const openVexBtn = page.getByRole('button', { name: /Ingest OpenVEX/i });
    await openVexBtn.click();
    await expect(page.getByText(/OpenVEX Advisory Registered!/i)).toBeVisible({ timeout: 10000 });

    const topologyBtn = page.getByRole('button', { name: /Register Topology/i });
    await topologyBtn.click();
    await expect(page.getByText(/Deployment Topology Registered!/i)).toBeVisible({ timeout: 10000 });

    // Test 1-Click Load Sample Data button
    const loadSampleBtn = page.getByTestId('load-sample-data-btn');
    await loadSampleBtn.click();
    await expect(page.getByText(/Sample Data Loaded/i)).toBeVisible({ timeout: 10000 });

    // Test real file upload
    const testSbom = JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      metadata: { component: { name: 'e2e-service' } },
      components: [
        { name: 'fastapi-security', version: '1.0.0', purl: 'pkg:pypi/fastapi-security@1.0.0' }
      ]
    });
    await page.setInputFiles('input[type="file"]', {
      name: 'fastapi_sbom.json',
      mimeType: 'application/json',
      buffer: Buffer.from(testSbom)
    });
    await expect(page.getByText(/fastapi_sbom.json/i).first()).toBeVisible({ timeout: 10000 });

    // ==========================================
    // OPERATION 5: PRIORITIZED RISK INTELLIGENCE
    // ==========================================
    await page.getByTestId('nav-prioritization').click();
    await expect(page.getByText('Prioritized Risk Register')).toBeVisible();
    await expect(page.getByText(/0\.9482/)).toBeVisible(); // PR-AUC badge
    await expect(page.getByText(/0\.1194/)).toBeVisible(); // Brier score badge
    await expect(page.getByText('CVE-2026-1001').first()).toBeVisible();

    // Test environment filter
    const envSelect = page.getByTestId('risk-env-filter');
    await envSelect.selectOption('prod');
    await expect(page.getByText('CVE-2026-1001').first()).toBeVisible();
    await envSelect.selectOption('all');

    // Test KEV filter
    const kevSelect = page.getByTestId('risk-kev-filter');
    await kevSelect.selectOption('kev');
    await expect(page.getByText('CVE-2026-1001').first()).toBeVisible();
    await kevSelect.selectOption('all');

    // Test search filter
    const searchFindingsInput = page.getByPlaceholder(/Search CVE, package or service/i);
    await searchFindingsInput.fill('example-lib');
    await expect(page.getByText('CVE-2026-1001').first()).toBeVisible();
    await searchFindingsInput.fill('');

    // Test Explain Drawer
    const explainBtn = page.getByRole('button', { name: /Explain/i }).first();
    await explainBtn.click();
    await expect(page.getByText('Risk Factor Breakdown')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Log-Odds Feature Contributions')).toBeVisible();
    await expect(page.getByText('Calibration Formula')).toBeVisible();
    await expect(page.getByText('Calibration Model Details')).toBeVisible();

    // Close Explain drawer
    await page.getByTestId('close-explain-drawer').click();
    await expect(page.getByTestId('close-explain-drawer')).toBeHidden();

    // ==========================================
    // OPERATION 6: CYTOSCAPE DEPENDENCY GRAPH
    // ==========================================
    await page.getByTestId('nav-dependency-graph').click();
    await expect(page.getByText('Dependency & Deployment Graph')).toBeVisible();

    // Toggle 3D and 2D view modes
    const mode3dBtn = page.getByRole('button', { name: '3D Tiers' });
    if (await mode3dBtn.isVisible()) {
      await mode3dBtn.click();
      await page.getByRole('button', { name: '2D Cytoscape' }).click();
    }

    // Filter KEV on graph
    const kevGraphCheckbox = page.locator('main input[type="checkbox"]');
    if (await kevGraphCheckbox.isVisible()) {
      await kevGraphCheckbox.check();
      await kevGraphCheckbox.uncheck();
    }

    // ==========================================
    // OPERATION 7: CP-SAT REMEDIATION PLANNER
    // ==========================================
    await page.getByTestId('nav-remediation-planner').click();
    await expect(page.getByText('Constrained Remediation Planner')).toBeVisible();

    // Adjust sliders / number inputs
    const budgetInput = page.locator('main input[type="number"]').first();
    if (await budgetInput.isVisible()) {
      await budgetInput.fill('12');
    }

    // Run CP-SAT Optimizer
    const runOptimizerBtn = page.getByRole('button', { name: /Run CP-SAT Optimizer/i });
    await runOptimizerBtn.click();
    await expect(page.getByText('PROVABLY OPTIMAL', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Recommended Action Sequence')).toBeVisible();

    // Compare with Alternatives Modal
    const compareBtn = page.getByTestId('compare-plans-btn');
    await compareBtn.click();
    await expect(page.getByTestId('plan-comparison-view')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Side-by-Side Plan Comparison')).toBeVisible();
    await expect(page.getByText(/Plan A: Baseline/i)).toBeVisible();
    await expect(page.getByText(/Plan B: Expanded/i)).toBeVisible();

    // Close comparison modal
    await page.getByRole('button', { name: 'Close Comparison' }).click();
    await expect(page.getByTestId('plan-comparison-view')).toBeHidden();

    // ==========================================
    // OPERATION 8: HUMAN REVIEW & AUDIT LOG
    // ==========================================
    await page.getByTestId('nav-audit').click();
    await expect(page.getByText('Human Decision Gate')).toBeVisible();
    await expect(page.getByText('Immutable Audit Ledger')).toBeVisible();

    // Test rejection of empty comment
    const approveBtn = page.getByRole('button', { name: /Approve Plan/i });
    await approveBtn.click();
    await expect(page.getByText(/comment\/justification is required/i)).toBeVisible();

    // Provide comment and approve
    const commentArea = page.getByPlaceholder(/Enter required justification/i);
    await commentArea.fill('Comprehensive automated live test completed. Approved.');
    await approveBtn.click();
    await expect(page.getByText(/Decision 'APPROVED' committed to immutable audit entry/i)).toBeVisible({ timeout: 10000 });

    // Test audit log search
    const auditSearch = page.getByPlaceholder('Filter audit log...');
    await auditSearch.fill('DECISION');
    await expect(page.getByText('PLAN_DECISION').first()).toBeVisible();
    await auditSearch.fill('');

    // ==========================================
    // OPERATION 9: ASSETS INVENTORY
    // ==========================================
    await page.goto('http://127.0.0.1:5000/assets');
    await expect(page.getByText('Deployment Context & Asset Inventory')).toBeVisible();
    const assetsEnvFilter = page.locator('#env-filter');
    await assetsEnvFilter.selectOption('prod');
    await assetsEnvFilter.selectOption('staging');
    await assetsEnvFilter.selectOption('all');

    // ==========================================
    // OPERATION 10: SETTINGS & SYSTEM CONFIG
    // ==========================================
    await page.goto('http://127.0.0.1:5000/settings');
    await expect(page.getByText('Environment & Connector Settings')).toBeVisible();
    await expect(page.getByText('Data Source Connectors')).toBeVisible();
    await expect(page.getByText('Accessibility & Motion')).toBeVisible();

    // Test motion toggle button
    const motionBtn = page.getByRole('button', { name: /Enabled|Reduced Motion/i });
    if (await motionBtn.isVisible()) {
      await motionBtn.click();
      await motionBtn.click();
    }

    // Verify 0 runtime exceptions occurred
    expect(errors).toHaveLength(0);
  });
});
