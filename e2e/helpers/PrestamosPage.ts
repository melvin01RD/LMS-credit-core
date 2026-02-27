import { Page, expect } from '@playwright/test';

export class PrestamosPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/dashboard/loans');
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByRole('heading', { name: 'Préstamos' })).toBeVisible();
  }

  async abrirModalNuevoPrestamo() {
    // Selector confirmed from e2e/loans.spec.ts
    await this.page.getByRole('button', { name: 'Nuevo Préstamo' }).click();
    await expect(this.page.getByRole('heading', { name: 'Nuevo Préstamo' })).toBeVisible();
  }

  async crearPrestamo(datos: {
    clienteNombre: string;
    monto: number;
    cargoFinanciero: number;
    numeroCuotas: number;
    frecuencia?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY';
  }) {
    // Selectors confirmed from e2e/loans.spec.ts
    await this.abrirModalNuevoPrestamo();

    // Buscar cliente
    await this.page.getByPlaceholder(/buscar cliente/i).fill(datos.clienteNombre);
    await this.page.waitForTimeout(400);
    await this.page.locator('.client-dropdown').waitFor({ state: 'visible' });
    await this.page.locator('.client-dropdown li, .client-option').first().click();

    // Monto principal
    await this.page.getByPlaceholder('50000').fill(String(datos.monto));

    // Cargo financiero total
    await this.page.getByPlaceholder('3500').fill(String(datos.cargoFinanciero));

    // Número de cuotas
    await this.page.getByPlaceholder('45').fill(String(datos.numeroCuotas));

    await this.page.getByRole('button', { name: /guardar|crear préstamo/i }).click();
    await this.page.waitForLoadState('networkidle');
  }
}
