import { Page } from '@playwright/test';

export const ADMIN = {
  email: 'melvin01rd@gmail.com',
  password: 'Admin123',
};

export const OPERATOR = {
  email: 'operador.prueba@lmscredit.com',
  password: 'Operador2024!',
};

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('usuario@ejemplo.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard');
}

export async function loginAsAdmin(page: Page) {
  await login(page, ADMIN.email, ADMIN.password);
}

export async function loginAsOperator(page: Page) {
  await login(page, OPERATOR.email, OPERATOR.password);
}
