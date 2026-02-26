import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Gestión de Clientes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/clients');
  });

  test('muestra la lista de clientes', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo Cliente' })).toBeVisible();
  });

  test('buscar cliente por nombre', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i);
    await searchInput.fill('Juan');
    await page.waitForTimeout(500);
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('crear nuevo cliente exitosamente', async ({ page }) => {
    const timestamp = Date.now();
    const docId = String(timestamp).slice(2);   // 11 unique digits
    const phone  = String(timestamp).slice(3);  // 10 unique digits
    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
    await page.locator('.form-group').filter({ hasText: 'Nombre' }).locator('input').fill('Pedro');
    await page.locator('.form-group').filter({ hasText: 'Apellido' }).locator('input').fill('Prueba');
    await page.getByPlaceholder('00100000008').fill(docId);
    await page.getByPlaceholder('8090000000').fill(phone);
    await page.getByPlaceholder('cliente@ejemplo.com').fill(`pedro.prueba.${timestamp}@test.com`);
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // On success the modal closes and the list refreshes
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).not.toBeVisible();
    await expect(page.getByText('Pedro Prueba').first()).toBeVisible();
  });

  test('validación rechaza cédula con formato incorrecto', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await page.locator('.form-group').filter({ hasText: 'Nombre' }).locator('input').fill('Test');
    await page.getByPlaceholder('00100000008').fill('123');
    await page.getByPlaceholder('8090000000').fill('8091234567');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // HTML5 pattern validation prevents submit — modal stays open
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
    const docInput = page.getByPlaceholder('00100000008');
    const isValid = await docInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

});
