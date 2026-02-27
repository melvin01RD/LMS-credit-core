import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';

const SEARCH_TERM = 'Esmirna';

test.describe('PAG — Gestión de Pagos', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
  });

  test('PAG-01: Listado global de pagos carga correctamente', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/payments/);
    await expect(
      page.locator('table, [data-testid="pagos-list"], h1').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('PAG-02: Modal de registrar pago abre y muestra campos', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.getByRole('button', { name: 'Registrar Pago' }).first().click();

    await expect(page.getByRole('heading', { name: 'Registrar Pago' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por nombre o documento del cliente...')).toBeVisible();
    await expect(page.locator('#totalAmount')).toBeVisible();
    await expect(page.locator('#paymentDate')).toBeVisible();
  });

  test('PAG-03: Submit deshabilitado sin préstamo seleccionado', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.getByRole('button', { name: 'Registrar Pago' }).first().click();
    await expect(page.getByRole('heading', { name: 'Registrar Pago' })).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('PAG-04: Buscar préstamo por nombre real muestra resultados', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.getByRole('button', { name: 'Registrar Pago' }).first().click();

    await page.getByPlaceholder('Buscar por nombre o documento del cliente...').fill(SEARCH_TERM);
    await page.waitForSelector('.search-results', { timeout: 5_000 });
    await expect(page.locator('.search-results')).toBeVisible();
    await expect(page.locator('.search-result-item').first()).toBeVisible();
  });

  test('PAG-05: Seleccionar préstamo muestra loan-info con datos clave', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.getByRole('button', { name: 'Registrar Pago' }).first().click();

    await page.getByPlaceholder('Buscar por nombre o documento del cliente...').fill(SEARCH_TERM);
    await page.waitForSelector('.search-results', { timeout: 5_000 });
    await page.locator('.search-result-item').first().click();

    const loanInfo = page.locator('.loan-info');
    await expect(loanInfo).toBeVisible();
    await expect(loanInfo).toContainText('Cliente:');
    await expect(loanInfo).toContainText('Saldo pendiente:');
    await expect(loanInfo).toContainText('Cuota:');
  });

  test('PAG-06: Monto cero → muestra .field-error', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.getByRole('button', { name: 'Registrar Pago' }).first().click();

    await page.getByPlaceholder('Buscar por nombre o documento del cliente...').fill(SEARCH_TERM);
    await page.waitForSelector('.search-results', { timeout: 5_000 });
    await page.locator('.search-result-item').first().click();
    await expect(page.locator('.loan-info')).toBeVisible();

    await page.locator('#totalAmount').fill('0');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.field-error')).toBeVisible();
  });

  test('PAG-07: Cancelar el modal lo cierra sin registrar', async ({ page }) => {
    await page.goto('/dashboard/payments');
    await page.getByRole('button', { name: 'Registrar Pago' }).first().click();
    await expect(page.getByRole('heading', { name: 'Registrar Pago' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar Pago' })).not.toBeVisible();
  });
});
