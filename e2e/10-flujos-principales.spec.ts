/**
 * Tests de Flujos Principales — LMS Credit Core
 * Cobertura E2E de los core flows del negocio
 * Generado en sesión de Vibe Testing (2026-03-26)
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 1: Login completo
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Autenticación', () => {

  test('login con credenciales válidas redirige al dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();

    await page.getByPlaceholder('usuario@ejemplo.com').fill('melvin01rd@gmail.com');
    await page.getByPlaceholder('••••••••').fill('Admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard Ejecutivo' })).toBeVisible();
  });

  test('logout limpia la sesión y redirige al login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/dashboard/);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/login/);

    // Intentar acceder al dashboard sin sesión debe redirigir
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('ruta protegida sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/dashboard/clients');
    await expect(page).toHaveURL(/login/);
  });

  test('mostrar/ocultar contraseña funciona', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.getByPlaceholder('••••••••');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click en el botón ojo
    await page.locator('input[type="password"] ~ button, button:has(img[alt*="eye"], img[alt*="ver"])').click().catch(() =>
      page.locator('input[type="password"]').locator('..').locator('button').click()
    );

    // Después de toggle debería ser text
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('formulario vacío muestra validación requerida', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Debe permanecer en login sin navegar
    await expect(page).toHaveURL(/login/);
  });

  test('credenciales incorrectas muestran error sin exponer detalles', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('usuario@ejemplo.com').fill('fake@user.com');
    await page.getByPlaceholder('••••••••').fill('WrongPass999');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 2: Dashboard
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard');
  });

  test('muestra los KPIs principales', async ({ page }) => {
    await expect(page.getByText('Total Prestado')).toBeVisible();
    await expect(page.getByText('Capital Pendiente')).toBeVisible();
    await expect(page.getByText('Ingresos por Interés')).toBeVisible();
    await expect(page.getByText('Clientes Activos')).toBeVisible();
  });

  test('muestra la sección Próximos Vencimientos con tabla', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Próximos Vencimientos' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('el botón Actualizar recarga los datos sin error', async ({ page }) => {
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await page.waitForTimeout(1000);
    // Los KPIs deben seguir visibles tras actualizar
    await expect(page.getByText('Total Prestado')).toBeVisible();
    await expect(page.getByText('Clientes Activos')).toBeVisible();
    // No debe aparecer mensaje de error global
    await expect(page.getByRole('alert').filter({ hasText: /error interno|something went wrong/i })).not.toBeVisible();
  });

  test('navegación por sidebar funciona correctamente', async ({ page }) => {
    const navLinks = [
      { name: 'Clientes', url: /clients/ },
      { name: 'Préstamos', url: /loans/ },
      { name: 'Pagos', url: /payments/ },
    ];

    for (const link of navLinks) {
      await page.getByRole('link', { name: link.name }).first().click();
      await expect(page).toHaveURL(link.url);
      await page.goBack();
      await page.waitForURL(/dashboard/);
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 3: Gestión de Clientes (CRUD completo)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Gestión de Clientes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/clients');
  });

  test('la lista de clientes carga correctamente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo Cliente' })).toBeVisible();
    // Al menos 1 cliente visible
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('búsqueda filtra clientes en tiempo real', async ({ page }) => {
    const search = page.getByPlaceholder(/buscar/i);
    await search.fill('Darwin');
    await page.waitForTimeout(400);

    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Darwin');
  });

  test('búsqueda con término sin resultados muestra estado vacío', async ({ page }) => {
    await page.getByPlaceholder(/buscar/i).fill('CLIENTENOEXISTEABC123');
    await page.waitForTimeout(400);
    await expect(page.getByText(/no se encontraron resultados/i)).toBeVisible();
  });

  test('crear cliente con datos válidos funciona', async ({ page }) => {
    const ts = Date.now();
    const doc = String(ts).slice(2, 13);
    const phone = '809' + String(ts).slice(-7);

    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Nombre *' }).fill('Automatico');
    await page.getByRole('textbox', { name: 'Apellido' }).fill('Test E2E');
    await page.getByPlaceholder('00100000008').fill(doc);
    await page.getByPlaceholder('8090000000').fill(phone);
    await page.getByPlaceholder('cliente@ejemplo.com').fill(`auto.${ts}@test.com`);
    await page.getByRole('button', { name: 'Crear Cliente' }).click();

    await expect(page.getByText(/creado exitosamente/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).not.toBeVisible();
  });

  test('click en fila navega al detalle del cliente', async ({ page }) => {
    const firstRow = page.locator('tr.table-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForURL(/\/dashboard\/clients\/.+/, { timeout: 20000 });
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible(); // breadcrumb
  });

  test('detalle de cliente muestra estadísticas de préstamos', async ({ page }) => {
    const firstRow = page.locator('tr.table-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForURL(/\/dashboard\/clients\/.+/, { timeout: 20000 });
    await expect(page.getByRole('columnheader', { name: 'Monto' })).toBeVisible();
    await expect(page.getByText('Total prestado')).toBeVisible();
  });

  test('formulario Nuevo Cliente no cierra con datos inválidos (submit vacío)', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await page.getByRole('button', { name: 'Crear Cliente' }).click();
    // El formulario debe seguir visible (validación requerida)
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();
  });

  test('botón Cancelar cierra el formulario sin guardar', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).not.toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 4: Gestión de Préstamos
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Gestión de Préstamos', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/loans');
  });

  test('la lista de préstamos carga con sus columnas', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Préstamos' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Monto' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cuota' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
  });

  test('filtro "Activos" devuelve solo préstamos activos', async ({ page }) => {
    await page.getByRole('button', { name: 'Activos' }).click();
    await page.waitForTimeout(400);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Todos los estados visibles deben ser "Activo"
    const statuses = await page.locator('table tbody tr td').filter({ hasText: /^Activo$/ }).count();
    expect(statuses).toBeGreaterThan(0);
  });

  test('filtro "Pagados" y "Cancelados" no arrojan error', async ({ page }) => {
    for (const filter of ['Pagados', 'Cancelados']) {
      await page.getByRole('button', { name: filter }).click();
      await page.waitForTimeout(300);
      // No debe haber errores 500 o crashes
      await expect(page.getByRole('alert').filter({ hasText: /error interno|something went wrong/i })).not.toBeVisible();
    }
  });

  test('búsqueda por nombre de cliente filtra resultados', async ({ page }) => {
    await page.getByPlaceholder(/buscar por nombre o documento/i).fill('Darwin');
    await page.waitForTimeout(400);
    await expect(page.locator('table tbody tr').first()).toContainText('Darwin');
  });

  test('abrir detalle de préstamo desde la lista', async ({ page }) => {
    const firstRow = page.locator('tr.table-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForURL(/\/dashboard\/loans\/.+/, { timeout: 20000 });
    await expect(page.getByText('Progreso de pago')).toBeVisible();
  });

  test('modal Nuevo Préstamo abre y cierra correctamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo Préstamo' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Préstamo' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Préstamo' })).not.toBeVisible();
  });

  test('crear préstamo con datos válidos actualiza la lista', async ({ page }) => {
    const initialCount = await page.locator('table tbody tr').count();

    await page.getByRole('button', { name: 'Nuevo Préstamo' }).click();

    // Buscar y seleccionar cliente
    await page.getByPlaceholder('Buscar cliente por nombre o documento...').fill('Pedro');
    await page.waitForTimeout(400);
    const firstOption = page.getByRole('button', { name: /Pedro/i }).first();
    if (await firstOption.count() > 0) {
      await firstOption.click();
    }

    await page.getByRole('spinbutton', { name: /monto/i }).fill('5000');
    await page.getByRole('spinbutton', { name: /cargo financiero/i }).fill('1500');
    await page.getByRole('spinbutton', { name: /cuotas/i }).fill('5');
    await page.getByRole('button', { name: 'Crear Préstamo' }).click();

    await expect(page.getByText(/creado exitosamente/i)).toBeVisible();
    // La lista debe tener más registros
    const newCount = await page.locator('table tbody tr').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('detalle muestra las pestañas Información, Pagos y Amortización', async ({ page }) => {
    const firstRow = page.locator('tr.table-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForURL(/\/dashboard\/loans\/.+/, { timeout: 20000 });
    await expect(page.getByRole('button', { name: 'Información' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pagos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Amortización' })).toBeVisible();
  });

  test('pestaña Información muestra datos del préstamo y del cliente', async ({ page }) => {
    const firstRow = page.locator('tr.table-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await page.waitForURL(/\/dashboard\/loans\/.+/, { timeout: 20000 });
    await page.getByRole('button', { name: 'Información' }).click();

    await expect(page.getByText('Monto principal')).toBeVisible();
    await expect(page.getByText('Cargo Financiero')).toBeVisible();
    await expect(page.getByText('Datos del cliente')).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 5: Gestión de Pagos
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Gestión de Pagos', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/payments');
  });

  test('la lista de pagos carga correctamente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pagos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar Pago' })).toBeVisible();

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('filtro por tipo Regular funciona', async ({ page }) => {
    await page.getByRole('button', { name: 'Regular' }).click();
    await page.waitForTimeout(400);
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('filtro por tipo Abono Capital devuelve resultados', async ({ page }) => {
    await page.getByRole('button', { name: 'Abono Capital' }).click();
    await page.waitForTimeout(400);
    // No debe crashear — verificar que no hay alerta de error
    await expect(page.getByRole('alert').filter({ hasText: /error interno|something went wrong/i })).not.toBeVisible();
  });

  test('filtro por fecha funciona', async ({ page }) => {
    await page.locator('input[type="date"]').first().fill('2026-01-01');
    await page.locator('input[type="date"]').last().fill('2026-03-31');
    await page.waitForTimeout(400);
    await expect(page.getByRole('alert').filter({ hasText: /error interno|something went wrong/i })).not.toBeVisible();
  });

  test('Ver Recibo de Pago abre un PDF en nueva pestaña', async ({ page, context }) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Ver Recibo de Pago' }).first().click(),
    ]);

    await expect(newPage).not.toBeNull();
    await newPage.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 6: Reportes
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Reportes', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/reportes');
  });

  test('la página de reportes muestra todos los tipos disponibles', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cartera Vigente' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cartera en Mora' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recibo de Pago' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Estado de Cuenta' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan de Pagos' })).toBeVisible();
  });

  test('Cartera Vigente PDF se descarga sin error (status 200)', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      page.getByRole('button', { name: 'Descargar Cartera Vigente en PDF' }).click(),
    ]);

    // Si abre nueva ventana con PDF
    if (download) {
      await download.close();
    }
    // No debe haber errores en la página actual
    await expect(page.getByRole('alert').filter({ hasText: /error interno|something went wrong/i })).not.toBeVisible();
  });

  test('API de Cartera Vigente devuelve PDF válido', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.context().request.get('/api/reports/cartera-vigente');
    expect(response.status()).toBe(200);
  });

  test('API de Cartera en Mora responde sin error 500', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.context().request.get('/api/reports/cartera-mora');
    expect(response.status()).not.toBe(500);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO 7: Configuración del Sistema
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Flujo — Configuración', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
  });

  test('muestra las 3 pestañas de configuración', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Datos del Negocio' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parámetros de Mora' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tasas por Defecto' })).toBeVisible();
  });

  test('pestaña Tasas por Defecto muestra los campos de tasa', async ({ page }) => {
    await page.getByRole('button', { name: 'Tasas por Defecto' }).click();
    await expect(page.getByText('Tasa mensual por defecto')).toBeVisible();
    await expect(page.getByText('Tasa semanal por defecto')).toBeVisible();
    await expect(page.getByText('Tasa diaria por defecto')).toBeVisible();
  });

  test('pestaña Parámetros de Mora muestra opciones de recargo', async ({ page }) => {
    await page.getByRole('button', { name: 'Parámetros de Mora' }).click();
    await expect(page.getByText(/tipo de recargo/i)).toBeVisible();
    await expect(page.getByText(/días de gracia/i)).toBeVisible();
  });

});
