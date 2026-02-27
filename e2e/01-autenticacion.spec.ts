import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';

test.describe('AUTH — Autenticación', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('AUTH-01: Login ADMIN exitoso → redirige a dashboard', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText('ADMIN').first()).toBeVisible({ timeout: 10_000 });
  });

  test('AUTH-02: Login OPERATOR → no ve menú Usuarios', async ({ page }) => {
    await loginPage.loginAsOperator();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('link', { name: 'Usuarios' })).not.toBeVisible();
  });

  test('AUTH-03: Credenciales incorrectas → muestra error, NO redirige', async ({ page }) => {
    await loginPage.login('noexiste@test.com', 'contraseña-incorrecta-99999');
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText(/credenciales|incorrecta|inválid/i)).toBeVisible({ timeout: 5_000 });
  });

  test('AUTH-04: Campos vacíos → validación nativa bloquea el submit', async ({ page }) => {
    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('/api/auth/login')) apiCalled = true;
    });

    await loginPage.submitButton.click();
    await page.waitForTimeout(1_000);

    expect(apiCalled).toBe(false);
    await expect(page).toHaveURL(/login/);
  });

  test('AUTH-05: Acceso directo a /dashboard sin sesión → redirige a /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('AUTH-06: Cerrar sesión elimina la sesión', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await page.getByRole('button', { name: /cerrar sesión|logout|salir/i }).first().click();
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
    // Volver al dashboard debe redirigir a login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('AUTH-07: Persistencia de sesión al recargar la página', async ({ page }) => {
    await loginPage.loginAsAdmin();
    await page.reload();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText('ADMIN').first()).toBeVisible({ timeout: 10_000 });
  });

  test('AUTH-08: OPERATOR bloqueado en /dashboard/users por URL directa', async ({ page }) => {
    await loginPage.loginAsOperator();
    await page.goto('/dashboard/users');
    const isOnUsersPage = await page.getByRole('heading', { name: 'Usuarios' }).isVisible().catch(() => false);
    expect(isOnUsersPage).toBe(false);
  });
});
