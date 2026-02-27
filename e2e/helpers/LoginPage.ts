import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Selectors confirmed from e2e/helpers.ts and e2e/auth.spec.ts
    this.emailInput    = page.getByPlaceholder('usuario@ejemplo.com');
    this.passwordInput = page.getByPlaceholder('••••••••');
    this.submitButton  = page.getByRole('button', { name: 'Entrar' });
    this.errorMessage  = page.locator('[role="alert"], .error-message, .field-error').first();
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page).toHaveURL(/login/);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAsAdmin() {
    await this.login(
      process.env.ADMIN_EMAIL ?? 'melvin01rd@gmail.com',
      process.env.ADMIN_PASSWORD ?? 'Admin123',
    );
    await expect(this.page).toHaveURL(/dashboard/, { timeout: 15_000 });
  }

  async loginAsOperator() {
    await this.login(
      process.env.OPERATOR_EMAIL ?? 'operador.prueba@lmscredit.com',
      process.env.OPERATOR_PASSWORD ?? 'Operador2024!',
    );
    await expect(this.page).toHaveURL(/dashboard/, { timeout: 15_000 });
  }
}
