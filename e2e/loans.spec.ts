import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Gestión de Préstamos', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/loans');
  });

  test('muestra la lista de préstamos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Préstamos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo Préstamo' })).toBeVisible();
  });

  test('filtrar préstamos por estado ACTIVE', async ({ page }) => {
    await page.getByRole('button', { name: 'Activos' }).click();
    await page.waitForTimeout(400);
    // Verify at least one "Activo" badge is visible after filtering
    await expect(page.locator('.status-badge').filter({ hasText: 'Activo' }).first()).toBeVisible();
  });

  test('abrir modal de nuevo préstamo', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Préstamo' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Préstamo' })).toBeVisible();
    await expect(page.getByPlaceholder(/buscar cliente/i)).toBeVisible();
    await expect(page.getByPlaceholder('50000')).toBeVisible();
    await expect(page.getByPlaceholder('3500')).toBeVisible();
  });

  test('cuota estimada se calcula automáticamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Préstamo' }).click();
    await page.getByPlaceholder('50000').fill('10000');
    await page.getByPlaceholder('3500').fill('2000');
    await page.getByPlaceholder('45').fill('8');
    await expect(page.getByText(/cuota estimada/i)).toBeVisible();
    await expect(page.getByText('1,500.00')).toBeVisible();
  });

  test('buscar cliente en el modal de préstamo', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Préstamo' }).click();
    await page.getByPlaceholder(/buscar cliente/i).fill('Juan');
    await page.waitForTimeout(400);
    const dropdown = page.locator('.client-dropdown');
    await expect(dropdown).toBeVisible();
  });

});
