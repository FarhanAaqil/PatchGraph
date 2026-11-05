import { test, expect } from '@playwright/test';

test.describe('PatchGraph Real File Upload E2E', () => {
  test('uploads a CycloneDX SBOM file via drag-and-drop or file input and verifies ingestion', async ({ page }) => {
    await page.goto('http://127.0.0.1:5000/');
    await page.getByTestId('nav-imports').click();

    // Verify upload dropzone exists
    await expect(page.getByText('Drag & Drop', { exact: false }).first()).toBeVisible({ timeout: 8000 });

    // Upload a test file via hidden input
    const fileContent = JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      metadata: { component: { name: 'real-e2e-app' } },
      components: [
        { name: 'auth-jwt', version: '2.1.0', purl: 'pkg:npm/auth-jwt@2.1.0' },
      ],
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'e2e_bom.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent),
    });

    // Verify upload success banner
    await expect(page.getByText(/Ingestion Successful!/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('e2e_bom.json').first()).toBeVisible({ timeout: 10000 });
  });
});
