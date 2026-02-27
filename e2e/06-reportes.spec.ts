import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { LoginPage } from './helpers/LoginPage';

const CLIENT_SEARCH = 'Esmirna';

async function searchAndSelectClient(page: import('@playwright/test').Page, query: string) {
  await page.getByPlaceholder(/buscar por nombre o c/i).fill(query);
  await page.waitForSelector('.dropdown-item', { timeout: 6_000 });
  await page.locator('.dropdown-item').first().click();
  await expect(page.locator('.selected-client-info')).toBeVisible();
}

async function selectFirstLoan(page: import('@playwright/test').Page) {
  await page.waitForSelector('.loan-item', { timeout: 6_000 });
  await page.locator('.loan-item').first().click();
}

async function verifyDownload(
  page: import('@playwright/test').Page,
  trigger: () => Promise<void>,
) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    trigger(),
  ]);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const { size } = await fs.stat(filePath!);
  expect(size).toBeGreaterThan(1_024);
}

test.describe('REP — Reportes y Exportaciones', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
  });

  test('REP-01: Página de reportes carga con todas las tarjetas', async ({ page }) => {
    await page.goto('/dashboard/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByText('Cartera Vigente')).toBeVisible();
    await expect(page.getByText('Pagaré Notarial')).toBeVisible();

    await page.waitForSelector('.badge-available', { timeout: 6_000 });
    const count = await page.locator('.badge-available').count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('REP-02: Cartera Vigente — descarga PDF válido (>0 bytes)', async ({ page }) => {
    await loginPage_login(page);
    const response = await page.context().request.get('/api/reports/cartera-vigente');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('REP-03: Cartera Vigente — descarga Excel válido', async ({ page }) => {
    const response = await page.context().request.get('/api/reports/cartera-vigente-excel');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats');
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('REP-04: Estado de Cuenta — descarga PDF >1KB', async ({ page }) => {
    await page.goto('/dashboard/reportes/estado-cuenta');
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);

    const [download, response] = await Promise.all([
      page.waitForEvent('download'),
      page.waitForResponse(r => r.url().includes('/api/reports/estado-cuenta')),
      page.getByRole('button', { name: 'Descargar PDF' }).click(),
    ]);

    expect(response.headers()['content-type']).toContain('application/pdf');
    const filePath = await download.path();
    const { size } = await fs.stat(filePath!);
    expect(size).toBeGreaterThan(1_024);
  });

  test('REP-05: Plan de Pagos — descarga PDF >1KB', async ({ page }) => {
    await page.goto('/dashboard/reportes/plan-pagos');
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

  test('REP-06: Contrato — descarga PDF >1KB', async ({ page }) => {
    await page.goto('/dashboard/reportes/contrato');
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

  test('REP-07: Nota de Pagaré — descarga PDF >1KB', async ({ page }) => {
    await page.goto('/dashboard/reportes/nota-pagare');
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

  test('REP-08: Botones de descarga visibles en la tarjeta de Cartera Vigente', async ({ page }) => {
    await page.goto('/dashboard/reportes');
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Descargar Excel/i })).toBeVisible();
  });
});

// Helper local para REP-02 que ya tiene sesión activa desde beforeEach
async function loginPage_login(_page: import('@playwright/test').Page) {
  // La sesión ya está activa desde beforeEach — no se necesita hacer nada
}
