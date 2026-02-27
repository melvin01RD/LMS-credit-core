import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';

test.describe('RBAC — Control de Acceso por Rol', () => {

  test('USR-01: OPERATOR no ve enlace Usuarios en el menú', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsOperator();

    await expect(page.getByRole('link', { name: 'Usuarios' })).not.toBeVisible();
  });

  test('USR-02: OPERATOR bloqueado en /dashboard/users por URL directa', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsOperator();

    await page.goto('/dashboard/users');
    const estaEnUsuarios = await page
      .getByRole('heading', { name: 'Usuarios' })
      .isVisible()
      .catch(() => false);
    expect(estaEnUsuarios).toBe(false);
  });

  test('USR-03: GET /api/users retorna 403 con sesión de OPERATOR', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsOperator();

    const response = await page.context().request.get('/api/users');
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  test('USR-04: GET /api/settings retorna 403 con sesión de OPERATOR', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsOperator();

    const response = await page.context().request.get('/api/settings');
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  test('CRON-01: POST /api/cron/process-overdue sin CRON_SECRET → 401', async ({ request }) => {
    const response = await request.post('/api/cron/process-overdue', {
      headers: { Authorization: 'Bearer token-invalido-12345' },
    });
    expect(response.status()).toBe(401);
  });

  test('ADMIN-01: ADMIN puede acceder a /dashboard/users', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    await page.goto('/dashboard/users');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible({ timeout: 10_000 });
  });

  test('ADMIN-02: ADMIN puede acceder a /dashboard/settings', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    // No debe redirigir a login ni mostrar 403
    await expect(page).not.toHaveURL(/login/);
  });
});
