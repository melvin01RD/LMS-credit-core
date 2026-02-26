import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOperator, ADMIN } from './helpers';

test.describe('Autenticación', () => {

  test('login exitoso como ADMIN redirige al dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText('Melvin Luis', { exact: true })).toBeVisible();
    await expect(page.getByText('ADMIN').first()).toBeVisible();
  });

  test('login exitoso como OPERADOR redirige al dashboard', async ({ page }) => {
    await loginAsOperator(page);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText('OPERATOR').first()).toBeVisible();
  });

  test('credenciales incorrectas muestra error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('usuario@ejemplo.com').fill(ADMIN.email);
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/credenciales|incorrecta|inválid/i)).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test('ruta protegida redirige a login sin sesión', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('OPERADOR no puede acceder a usuarios', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/dashboard/users');
    await expect(page.getByRole('link', { name: 'Usuarios' })).not.toBeVisible();
  });

});
