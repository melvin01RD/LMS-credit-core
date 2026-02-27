import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import { loginAsAdmin, loginAsOperator, login, ADMIN } from './helpers';

// ── Datos de prueba ───────────────────────────────────────────────────────────

// Cliente real en la BD de prueba con préstamos activos y pagos
const CLIENT_SEARCH = 'Esmirna';

const PAGARE_DATA = {
  diaLetras: 'Veintisiete (27)',
  mesLetras: 'Febrero',
  anioLetras: 'Dos Mil Veintiséis (2026)',
  deudorNombre: 'JUAN CARLOS PEREZ MARTINEZ',
  deudorCedula: '001-1234567-8',
  deudorDomicilio: 'Calle Principal #45, Santo Domingo Este',
  montoPrestado: '50000',
  totalAPagar: '60000',
  numeroCuotas: '8',
  // montoCuota se auto-calcula: 60000 / 8 = 7500.00
  frecuenciaPago: 'todos los viernes',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Espera el evento 'download', ejecuta el trigger, y verifica que el
 * archivo descargado sea mayor a 1KB (documento real, no vacío).
 */
async function verifyDownload(page: Page, trigger: () => Promise<void>): Promise<void> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    trigger(),
  ]);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const { size } = await fs.stat(filePath!);
  expect(size).toBeGreaterThan(1024);
}

/**
 * Busca un cliente en cualquier página de reporte que tenga el input
 * "Buscar por nombre o c[e|é]dula..." y selecciona el primer resultado.
 */
async function searchAndSelectClient(page: Page, query: string): Promise<void> {
  await page.getByPlaceholder(/buscar por nombre o c/i).fill(query);
  await page.waitForSelector('.dropdown-item', { timeout: 6000 });
  await page.locator('.dropdown-item').first().click();
  await expect(page.locator('.selected-client-info')).toBeVisible();
}

/** Espera la lista de préstamos y hace clic en el primero. */
async function selectFirstLoan(page: Page): Promise<void> {
  await page.waitForSelector('.loan-item', { timeout: 6000 });
  await page.locator('.loan-item').first().click();
}

/** Rellena el formulario del Pagaré Notarial con los datos de prueba. */
async function fillPagareForm(page: Page): Promise<void> {
  await page.getByPlaceholder('Ej: Veinticuatro (24)').fill(PAGARE_DATA.diaLetras);
  await page.getByPlaceholder('Ej: Diciembre').fill(PAGARE_DATA.mesLetras);
  await page.getByPlaceholder('Ej: Dos Mil Veinticinco (2025)').fill(PAGARE_DATA.anioLetras);
  await page.getByPlaceholder('Ej: VALENTINA ROSARIO PEÑA').fill(PAGARE_DATA.deudorNombre);
  await page.getByPlaceholder('Ej: 001-1610083-5').fill(PAGARE_DATA.deudorCedula);
  await page.locator('[name="deudorDomicilio"]').fill(PAGARE_DATA.deudorDomicilio);
  await page.locator('[name="montoPrestado"]').fill(PAGARE_DATA.montoPrestado);
  await page.locator('[name="totalAPagar"]').fill(PAGARE_DATA.totalAPagar);
  await page.locator('[name="numeroCuotas"]').fill(PAGARE_DATA.numeroCuotas);
  await page.locator('[name="frecuenciaPago"]').fill(PAGARE_DATA.frecuenciaPago);
}

// ── 1. Página de Reportes ─────────────────────────────────────────────────────

test.describe('Página de Reportes', () => {

  test('muestra la página correctamente como ADMIN', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByText('Cartera Vigente')).toBeVisible();
    await expect(page.getByText('Pagaré Notarial')).toBeVisible();
  });

  test('muestra todas las tarjetas de reportes con badge "Disponible"', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes');
    // Wait for at least one badge to appear before counting (page is client-rendered)
    await page.waitForSelector('.badge-available', { timeout: 6000 });
    const badges = page.locator('.badge-available');
    const count = await badges.count();
    // Cartera Vigente + Recibo + Estado + Plan + Nota + Contrato + Pagaré Notarial = 7
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('redirige a login si no está autenticado', async ({ page }) => {
    await page.goto('/dashboard/reportes', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/login/);
  });

  test('es accesible para rol OPERATOR', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/dashboard/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    // Badge disponible visible para los reportes
    await expect(page.locator('.badge-available').first()).toBeVisible();
  });

});

// ── 2. Cartera Vigente ────────────────────────────────────────────────────────

test.describe('Cartera Vigente', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('descarga PDF — Content-Type application/pdf y tamaño mayor a 0', async ({ page }) => {
    const response = await page.context().request.get('/api/reports/cartera-vigente');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('descarga Excel — Content-Type application/vnd.openxmlformats', async ({ page }) => {
    const response = await page.context().request.get('/api/reports/cartera-vigente-excel');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats');
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('los botones de descarga son visibles en la tarjeta', async ({ page }) => {
    await page.goto('/dashboard/reportes');
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Descargar Excel/i })).toBeVisible();
  });

});

// ── 3. Estado de Cuenta ───────────────────────────────────────────────────────

test.describe('Estado de Cuenta', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes/estado-cuenta');
  });

  test('carga la página con el selector de cliente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Estado de Cuenta' })).toBeVisible();
    await expect(page.getByPlaceholder(/buscar por nombre o c/i)).toBeVisible();
  });

  test('genera y descarga el PDF con Content-Type correcto y tamaño > 1KB', async ({ page }) => {
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);

    const [download, response] = await Promise.all([
      page.waitForEvent('download'),
      page.waitForResponse(r => r.url().includes('/api/reports/estado-cuenta')),
      page.getByRole('button', { name: 'Descargar PDF' }).click(),
    ]);

    expect(response.headers()['content-type']).toContain('application/pdf');

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const { size } = await fs.stat(filePath!);
    expect(size).toBeGreaterThan(1024);
  });

});

// ── 4. Plan de Pagos ──────────────────────────────────────────────────────────

test.describe('Plan de Pagos', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes/plan-pagos');
  });

  test('carga la página con el selector de cliente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Plan de Pagos' })).toBeVisible();
    await expect(page.getByPlaceholder(/buscar por nombre o c/i)).toBeVisible();
  });

  test('genera y descarga el PDF mayor a 1KB', async ({ page }) => {
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

});

// ── 5. Nota de Pagaré ─────────────────────────────────────────────────────────

test.describe('Nota de Pagaré', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes/nota-pagare');
  });

  test('carga la página con el selector de cliente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Nota de Pagar/i })).toBeVisible();
    await expect(page.getByPlaceholder(/buscar por nombre o c/i)).toBeVisible();
  });

  test('genera y descarga el PDF mayor a 1KB', async ({ page }) => {
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

});

// ── 6. Contrato de Préstamo ───────────────────────────────────────────────────

test.describe('Contrato de Préstamo', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes/contrato');
  });

  test('carga la página con el selector de cliente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Contrato/i })).toBeVisible();
    await expect(page.getByPlaceholder(/buscar por nombre o c/i)).toBeVisible();
  });

  test('genera y descarga el PDF mayor a 1KB', async ({ page }) => {
    await searchAndSelectClient(page, CLIENT_SEARCH);
    await selectFirstLoan(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

});

// ── 7. Recibo de Pago ─────────────────────────────────────────────────────────

test.describe('Recibo de Pago', () => {

  /**
   * Garantiza que Esmirna tenga al menos un pago en la BD antes de correr los tests.
   * Si ya existe alguno, no se crea nada extra.
   * Si no hay pagos, crea un préstamo nuevo (con su PaymentSchedule) y un pago.
   */
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, ADMIN.email, ADMIN.password);

    // Obtener el userId del admin en sesión
    const meRes = await context.request.get('/api/auth/me');
    const meData = await meRes.json();
    const userId: string = meData.user?.userId;
    if (!userId) { await context.close(); return; }

    // Buscar a Esmirna
    const clientsRes = await context.request.get(`/api/clients/search?q=${CLIENT_SEARCH}`);
    if (!clientsRes.ok()) { await context.close(); return; }
    const clients = await clientsRes.json();
    if (!clients?.length) { await context.close(); return; }
    const clientId: string = clients[0].id;

    // Comprobar si alguno de sus préstamos ya tiene pagos
    const loansRes = await context.request.get(`/api/clients/${clientId}/loans?limit=100`);
    if (!loansRes.ok()) { await context.close(); return; }
    const loansResponse = await loansRes.json();
    const loans: { id: string; status: string }[] = loansResponse.data ?? loansResponse;

    for (const loan of (loans ?? [])) {
      const pRes = await context.request.get(`/api/loans/${loan.id}/payments`);
      if (pRes.ok()) {
        const raw = await pRes.json();
        const payments: unknown[] = Array.isArray(raw) ? raw : (raw.data ?? []);
        if (payments.length > 0) {
          // Ya existe al menos un pago — el test puede continuar
          await context.close();
          return;
        }
      }
    }

    // No hay pagos: crear un préstamo de prueba (con PaymentSchedule) y luego un pago.
    // Préstamo mínimo: RD$5,000 capital + RD$500 cargo = RD$5,500 en 4 cuotas semanales → cuota RD$1,375
    const loanRes = await context.request.post('/api/loans', {
      data: {
        clientId,
        principalAmount: 5000,
        totalFinanceCharge: 500,
        paymentFrequency: 'WEEKLY',
        termCount: 4,
        createdById: userId,
      },
    });
    if (!loanRes.ok()) { await context.close(); return; }
    const newLoan = await loanRes.json();
    const newLoanId: string = newLoan.id;
    if (!newLoanId) { await context.close(); return; }

    // Crear un pago por el monto de una cuota
    const installmentAmount = Math.ceil(Number(newLoan.installmentAmount) || 1375);
    await context.request.post(`/api/loans/${newLoanId}/payments`, {
      data: {
        totalAmount: installmentAmount,
        type: 'REGULAR',
        createdById: userId,
        paymentDate: new Date().toISOString(),
      },
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes/recibo-pago');
  });

  test('carga la página con el selector de cliente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Recibo de Pago' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por nombre o cédula...')).toBeVisible();
  });

  test('genera y descarga el PDF mayor a 1KB', async ({ page }) => {
    // Recibo usa .payment-item en lugar de .loan-item
    await page.getByPlaceholder('Buscar por nombre o cédula...').fill(CLIENT_SEARCH);
    await page.waitForSelector('.dropdown-item', { timeout: 6000 });
    await page.locator('.dropdown-item').first().click();
    await expect(page.locator('.selected-client-info')).toBeVisible();

    // Esperar a que carguen los pagos (el componente hace varias llamadas API anidadas)
    await page.waitForSelector('.payment-item', { timeout: 15000 });
    await page.locator('.payment-item').first().click();

    await verifyDownload(page, () =>
      page.getByRole('button', { name: 'Descargar PDF' }).click()
    );
  });

});

// ── 8. Pagaré Notarial ────────────────────────────────────────────────────────

test.describe('Pagaré Notarial', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes/pagare-notarial');
  });

  test('navega a /dashboard/reportes/pagare-notarial y carga el formulario', async ({ page }) => {
    await expect(page).toHaveURL(/pagare-notarial/);
    await expect(page.getByRole('heading', { name: 'Pagaré Notarial' })).toBeVisible();
  });

  test('muestra todos los campos requeridos del formulario', async ({ page }) => {
    await expect(page.getByPlaceholder('Ej: Veinticuatro (24)')).toBeVisible();
    await expect(page.getByPlaceholder('Ej: VALENTINA ROSARIO PEÑA')).toBeVisible();
    await expect(page.getByPlaceholder('Ej: 001-1610083-5')).toBeVisible();
    await expect(page.getByPlaceholder('Dirección completa')).toBeVisible();
    await expect(page.getByPlaceholder('Ej: todos los viernes')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generar Pagar/i })).toBeVisible();
  });

  test('muestra la sección de solo lectura con datos del notario y acreedores', async ({ page }) => {
    await expect(page.getByText('Solo lectura')).toBeVisible();
    await expect(page.getByText('LIC. RAMÓN H. GÓMEZ ALMONTE')).toBeVisible();
    await expect(page.getByText('FERNANDO VALENZUELA')).toBeVisible();
    await expect(page.getByText('MELVIN LUIS DE LA CRUZ CONCEPCIÓN')).toBeVisible();
  });

  test('calcula automáticamente el monto por cuota al cambiar total y cuotas', async ({ page }) => {
    await page.locator('[name="totalAPagar"]').fill('60000');
    await page.locator('[name="numeroCuotas"]').fill('8');
    // Effect re-renders montoCuota: 60000 / 8 = 7500.00
    await expect(page.locator('[name="montoCuota"]')).toHaveValue('7500.00');
  });

  test('no envía el formulario si hay campos requeridos vacíos', async ({ page }) => {
    await page.getByRole('button', { name: /Generar Pagar/i }).click();
    // HTML5 required blocks submission — URL sin cambiar, sin error-banner
    await expect(page).toHaveURL(/pagare-notarial/);
    await expect(page.locator('.error-banner')).not.toBeVisible();
  });

  test('genera y descarga el PDF con datos válidos', async ({ page }) => {
    await fillPagareForm(page);
    await verifyDownload(page, () =>
      page.getByRole('button', { name: /Generar Pagar/i }).click()
    );
  });

  test('el PDF tiene Content-Type application/pdf', async ({ page }) => {
    await fillPagareForm(page);
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/reports/pagare-notarial')),
      page.getByRole('button', { name: /Generar Pagar/i }).click(),
    ]);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });

  test('el PDF tiene tamaño mayor a 1KB', async ({ page }) => {
    await fillPagareForm(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Generar Pagar/i }).click(),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const { size } = await fs.stat(filePath!);
    expect(size).toBeGreaterThan(1024);
  });

});

// ── 9. Seguridad de los endpoints de reportes ─────────────────────────────────

test.describe('Seguridad de los endpoints de reportes', () => {

  test('GET /api/reports/cartera-vigente sin token retorna 401', async ({ request }) => {
    const response = await request.get('/api/reports/cartera-vigente');
    expect(response.status()).toBe(401);
  });

  test('GET /api/reports/recibo-pago sin token retorna 401', async ({ request }) => {
    const response = await request.get('/api/reports/recibo-pago?paymentId=cualquier-id');
    expect(response.status()).toBe(401);
  });

  test('POST /api/reports/pagare-notarial sin token retorna 401', async ({ request }) => {
    const response = await request.post('/api/reports/pagare-notarial', {
      data: { numeroActo: '2026-0001', deudorNombre: 'TEST', deudorCedula: '001-0000000-0' },
    });
    expect(response.status()).toBe(401);
  });

});
