import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// Real client data from DB — first ACTIVE loan
// Esmirna Isabel Calcaño | 04720007456 | balance: 80,000 | installment: 3,463.05
const SEARCH_TERM = 'Esmirna';

async function openModal(page: Page) {
  // The page header button opens the modal; .first() disambiguates from the
  // submit button inside the modal that also reads "Registrar Pago".
  await page.getByRole('button', { name: 'Registrar Pago' }).first().click();
  await expect(page.getByRole('heading', { name: 'Registrar Pago' })).toBeVisible();
}

test.describe('Registrar Pagos', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/payments');
  });

  // ── 1. Abrir modal ───────────────────────────────────────────────────────

  test('abre el modal de registrar pago desde la página de préstamos', async ({ page }) => {
    await openModal(page);

    await expect(page.getByPlaceholder('Buscar por nombre o documento del cliente...')).toBeVisible();
    await expect(page.locator('#totalAmount')).toBeVisible();
    await expect(page.locator('#paymentDate')).toBeVisible();
    await expect(page.locator('#paymentType')).toBeVisible();
  });

  // ── 2. Sin préstamo seleccionado ─────────────────────────────────────────
  // NOTE: El botón submit tiene `disabled={saving || !form.loanId}`, por lo
  // que cuando no hay préstamo seleccionado el botón está deshabilitado y no
  // es posible disparar handleSubmit ni mostrar .field-error.
  // El test verifica el comportamiento real: submit disabled → sin submit posible.

  test('botón Registrar Pago está deshabilitado sin préstamo seleccionado', async ({ page }) => {
    await openModal(page);

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  // ── 3. Validación rechaza monto cero o vacío ─────────────────────────────

  test('validación rechaza monto cero o vacío y muestra .field-error', async ({ page }) => {
    await openModal(page);

    // Primero hay que seleccionar un préstamo (activa el botón submit)
    await page.getByPlaceholder('Buscar por nombre o documento del cliente...').fill(SEARCH_TERM);
    await page.waitForSelector('.search-results', { timeout: 5000 });
    await page.locator('.search-result-item').first().click();
    await expect(page.locator('.loan-info')).toBeVisible();

    // Ingresar monto 0: pasa la validación nativa del browser (min="0")
    // pero falla la validación React (amount <= 0) → muestra .field-error
    await page.locator('#totalAmount').fill('0');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('.field-error')).toBeVisible();
  });

  // ── 4. Buscar préstamo por nombre real ───────────────────────────────────

  test('buscar préstamo por nombre real muestra .search-results', async ({ page }) => {
    await openModal(page);

    await page.getByPlaceholder('Buscar por nombre o documento del cliente...').fill(SEARCH_TERM);
    await page.waitForSelector('.search-results', { timeout: 5000 });

    await expect(page.locator('.search-results')).toBeVisible();
    await expect(page.locator('.search-result-item').first()).toBeVisible();
  });

  // ── 5. Seleccionar préstamo → loan-info ──────────────────────────────────

  test('seleccionar préstamo del dropdown muestra .loan-info con Cliente, Saldo pendiente y Cuota', async ({ page }) => {
    await openModal(page);

    await page.getByPlaceholder('Buscar por nombre o documento del cliente...').fill(SEARCH_TERM);
    await page.waitForSelector('.search-results', { timeout: 5000 });
    await page.locator('.search-result-item').first().click();

    const loanInfo = page.locator('.loan-info');
    await expect(loanInfo).toBeVisible();
    await expect(loanInfo).toContainText('Cliente:');
    await expect(loanInfo).toContainText('Saldo pendiente:');
    await expect(loanInfo).toContainText('Cuota:');
  });

  // ── 6. Cancelar cierra el modal ──────────────────────────────────────────

  test('cancelar el modal lo cierra sin registrar nada', async ({ page }) => {
    await openModal(page);

    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByRole('heading', { name: 'Registrar Pago' })).not.toBeVisible();
  });

});
