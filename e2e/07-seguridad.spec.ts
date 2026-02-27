import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers/LoginPage';

test.describe('SEC — Seguridad Básica', () => {

  test('SEC-01: Cookie de sesión tiene flag HttpOnly', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c =>
      c.name.includes('session') ||
      c.name.includes('token') ||
      c.name.includes('auth') ||
      c.name.startsWith('lms')
    );

    expect(sessionCookie, 'Debe existir una cookie de sesión').toBeDefined();
    expect(sessionCookie?.httpOnly, 'Cookie debe ser HttpOnly').toBe(true);
  });

  test('SEC-02: Cookie de sesión tiene flag Secure en producción', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c =>
      c.name.includes('session') ||
      c.name.includes('token') ||
      c.name.includes('auth') ||
      c.name.startsWith('lms')
    );

    expect(sessionCookie, 'Debe existir una cookie de sesión').toBeDefined();
    expect(sessionCookie?.secure, 'Cookie debe ser Secure (HTTPS)').toBe(true);
  });

  test('SEC-03: GET /api/clients sin autenticación → 401', async ({ request }) => {
    const response = await request.get('/api/clients');
    expect(response.status()).toBe(401);
  });

  test('SEC-04: GET /api/loans sin autenticación → 401', async ({ request }) => {
    const response = await request.get('/api/loans');
    expect(response.status()).toBe(401);
  });

  test('SEC-05: GET /api/payments sin autenticación → 401', async ({ request }) => {
    const response = await request.get('/api/payments');
    expect(response.status()).toBe(401);
  });

  test('SEC-06: Errores de API no exponen stack traces ni nombres de BD', async ({ request }) => {
    // Llamar sin auth — la respuesta de error no debe filtrar internals
    const response = await request.get('/api/clients');
    const body = await response.text();

    expect(body).not.toMatch(/at Object\.<anonymous>/);
    expect(body).not.toMatch(/node_modules/);
    expect(body).not.toMatch(/DATABASE_URL/i);
  });

  test('SEC-07: GET /api/dashboard/flat-rate sin autenticación → 401', async ({ request }) => {
    const response = await request.get('/api/dashboard/flat-rate');
    expect(response.status()).toBe(401);
  });

  test('SEC-08: GET /api/reports/cartera-vigente sin autenticación → 401', async ({ request }) => {
    const response = await request.get('/api/reports/cartera-vigente');
    expect(response.status()).toBe(401);
  });

  test('SEC-09: POST /api/reports/pagare-notarial sin autenticación → 401', async ({ request }) => {
    const response = await request.post('/api/reports/pagare-notarial', {
      data: { numeroActo: '2026-0001', deudorNombre: 'TEST', deudorCedula: '001-0000000-0' },
    });
    expect(response.status()).toBe(401);
  });
});
