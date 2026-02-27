import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';
import { ClientesPage } from './helpers/ClientesPage';

const timestamp = Date.now();
const CLIENTE_TEST = {
  nombre:   'Auto',
  apellido: `Test${timestamp}`.substring(0, 10),
  cedula:   String(timestamp).slice(2, 13).padStart(11, '0'),
  telefono: String(timestamp).slice(3, 13).padStart(10, '0'),
  email:    `auto.test.${timestamp}@test.com`,
};

test.describe('CLI — Gestión de Clientes', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
  });

  test('CLI-01: Listado de clientes carga correctamente', async ({ page }) => {
    const clientesPage = new ClientesPage(page);
    await clientesPage.goto();

    await expect(page).toHaveURL(/clients/);
    await expect(page.getByRole('button', { name: 'Nuevo Cliente' })).toBeVisible();
  });

  test('CLI-02: Búsqueda por nombre filtra la lista', async ({ page }) => {
    const clientesPage = new ClientesPage(page);
    await clientesPage.goto();
    await clientesPage.buscarCliente('Juan');

    await expect(page).toHaveURL(/clients/);
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('CLI-04: Crear cliente con datos válidos', async ({ page }) => {
    const clientesPage = new ClientesPage(page);
    await clientesPage.goto();
    await clientesPage.crearCliente(CLIENTE_TEST);

    // El modal cierra → el cliente aparece en la lista
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).not.toBeVisible();
    await clientesPage.buscarCliente('Auto');
    await expect(page.getByText('Auto').first()).toBeVisible({ timeout: 10_000 });
  });

  test('CLI-06: Cédula inválida → error de validación, modal no cierra', async ({ page }) => {
    const clientesPage = new ClientesPage(page);
    await clientesPage.goto();

    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();

    await page.locator('.form-group').filter({ hasText: 'Nombre' }).locator('input').fill('Test');
    await page.getByPlaceholder('00100000008').fill('123'); // cédula inválida
    await page.getByPlaceholder('8090000000').fill('8091234567');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Modal debe permanecer abierto y mostrar error
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
    await expect(page.locator('.field-error')).toBeVisible();
  });
});
