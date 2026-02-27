import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';

test.describe('DASH — Dashboard Ejecutivo', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
  });

  test('DASH-01: Métricas principales son visibles', async ({ page }) => {
    await expect(page.getByText('Total Prestado')).toBeVisible();
    await expect(page.getByText('Capital Pendiente')).toBeVisible();
    await expect(page.getByText('Cobros Hoy')).toBeVisible();
  });

  test('DASH-02: Sección Cartera Flat Rate visible', async ({ page }) => {
    await expect(page.getByText(/Cartera|Flat Rate/i).first()).toBeVisible();
  });

  test('DASH-03: Botón Actualizar recarga métricas sin errores', async ({ page }) => {
    const actualizarBtn = page.getByRole('button', { name: /actualizar/i }).first();
    await expect(actualizarBtn).toBeVisible();
    await actualizarBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Total Prestado')).toBeVisible();
  });

  test('DASH-04: Dashboard accesible para OPERATOR', async ({ page }) => {
    // Cerrar sesión como ADMIN
    await page.getByRole('button', { name: /cerrar sesión|logout|salir/i }).first().click();
    await expect(page).toHaveURL(/login/);

    const loginPage = new LoginPage(page);
    await loginPage.loginAsOperator();

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText('Total Prestado')).toBeVisible();
  });
});
