import { Page, expect } from '@playwright/test';

export class ClientesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/dashboard/clients');
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  }

  async crearCliente(datos: {
    nombre: string;
    apellido: string;
    cedula: string;
    telefono: string;
    email?: string;
  }) {
    // Selectors confirmed from e2e/clients.spec.ts
    await this.page.getByRole('button', { name: 'Nuevo Cliente' }).click();
    await expect(this.page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();

    await this.page.locator('.form-group').filter({ hasText: 'Nombre' }).locator('input').fill(datos.nombre);
    await this.page.locator('.form-group').filter({ hasText: 'Apellido' }).locator('input').fill(datos.apellido);
    await this.page.getByPlaceholder('00100000008').fill(datos.cedula);
    await this.page.getByPlaceholder('8090000000').fill(datos.telefono);

    if (datos.email) {
      await this.page.getByPlaceholder('cliente@ejemplo.com').fill(datos.email);
    }

    await this.page.getByRole('button', { name: /guardar|crear/i }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async buscarCliente(termino: string) {
    const searchInput = this.page.getByPlaceholder(/buscar/i);
    await searchInput.fill(termino);
    await this.page.waitForTimeout(500); // debounce
    await this.page.waitForLoadState('networkidle');
  }
}
