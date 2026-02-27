import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';
import { PrestamosPage } from './helpers/PrestamosPage';

test.describe('PRES — Gestión de Préstamos', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
  });

  test('PRES-01: Listado de préstamos carga correctamente', async ({ page }) => {
    const prestamosPage = new PrestamosPage(page);
    await prestamosPage.goto();

    await expect(page).toHaveURL(/loans/);
    await expect(page.getByRole('button', { name: 'Nuevo Préstamo' })).toBeVisible();
  });

  test('PRES-02: Filtrar préstamos por estado Activos', async ({ page }) => {
    const prestamosPage = new PrestamosPage(page);
    await prestamosPage.goto();

    await page.getByRole('button', { name: 'Activos' }).click();
    await page.waitForTimeout(400);
    // Al menos un badge Activo visible
    await expect(
      page.locator('.status-badge').filter({ hasText: 'Activo' }).first()
    ).toBeVisible();
  });

  test('PRES-03: Modal de nuevo préstamo muestra todos los campos', async ({ page }) => {
    const prestamosPage = new PrestamosPage(page);
    await prestamosPage.goto();
    await prestamosPage.abrirModalNuevoPrestamo();

    await expect(page.getByPlaceholder(/buscar cliente/i)).toBeVisible();
    await expect(page.getByPlaceholder('50000')).toBeVisible();
    await expect(page.getByPlaceholder('3500')).toBeVisible();
    await expect(page.getByPlaceholder('45')).toBeVisible();
  });

  test('PRES-04: Cuota estimada se calcula automáticamente', async ({ page }) => {
    const prestamosPage = new PrestamosPage(page);
    await prestamosPage.goto();
    await prestamosPage.abrirModalNuevoPrestamo();

    await page.getByPlaceholder('50000').fill('10000');
    await page.getByPlaceholder('3500').fill('2000');
    await page.getByPlaceholder('45').fill('8');

    await expect(page.getByText(/cuota estimada/i)).toBeVisible();
    await expect(page.getByText('1,500.00')).toBeVisible();
  });

  test('PRES-05: Detalle de préstamo muestra plan de pagos', async ({ page }) => {
    await page.goto('/dashboard/loans');
    await page.waitForLoadState('networkidle');

    const primerFila = page.locator('table tbody tr').first();
    if (!await primerFila.isVisible()) {
      test.skip(); return;
    }
    await primerFila.click();
    await page.waitForLoadState('networkidle');

   await expect(
  page.locator('table.table').first()
).toBeVisible({ timeout: 10_000 });
  });
});
