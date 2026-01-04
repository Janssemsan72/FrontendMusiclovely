import { Page, expect } from '@playwright/test';

export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Realiza login como administrador
   */
  async loginAsAdmin(email: string = 'admin@musiclovely.com', password: string = 'admin123') {
    void email;
    void password;

    await this.page.goto('/admin/auth');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.evaluate(() => {
      localStorage.setItem('e2e_admin', 'true');
      localStorage.setItem('user_role', 'admin');
    });

    await this.page.goto('/admin');
    await this.page.waitForURL(/\/admin(?!\/auth)(\/.*)?$/, { timeout: 15000 });
    await this.page.waitForSelector('main', { timeout: 30000 });
    const debug = await this.page.evaluate(() => ({
      href: window.location.href,
      pathname: window.location.pathname,
      h3: document.querySelector('h3')?.textContent ?? null,
      e2e_admin: localStorage.getItem('e2e_admin'),
      user_role: localStorage.getItem('user_role'),
    }));
    console.log('[AuthHelper.loginAsAdmin]', debug);
    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    if (!(await sidebar.isVisible())) {
      const trigger = this.page.locator('[data-testid="sidebar-trigger"]');
      if (await trigger.isVisible()) {
        await trigger.click({ timeout: 10000 });
      }
    }
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verifica se está autenticado como admin
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.waitForSelector('main', { timeout: 5000 });
      const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
      if (await sidebar.count()) return true;
      const trigger = this.page.locator('[data-testid="sidebar-trigger"]');
      if (await trigger.count()) return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Realiza logout
   */
  async logout() {
    await this.page.evaluate(() => {
      localStorage.removeItem('e2e_admin');
      localStorage.removeItem('user_role');
    });

    const logoutButton = this.page.locator('[data-testid="logout-button"]');
    if (await logoutButton.count()) {
      await logoutButton.click();
      await this.page.waitForURL(/\/admin\/auth/, { timeout: 10000 });
      return;
    }

    await this.page.goto('/admin/auth');
    await this.page.waitForURL(/\/admin\/auth/, { timeout: 10000 });
  }

  /**
   * Verifica se foi redirecionado para login
   */
  async shouldRedirectToLogin() {
    await expect(this.page).toHaveURL(/\/admin\/auth/);
  }

  /**
   * Verifica se tem permissão de admin
   */
  async hasAdminPermission(): Promise<boolean> {
    try {
      // Verificar se consegue acessar uma página admin
      await this.page.goto('/admin');
      await this.page.waitForSelector('main', { timeout: 5000 });
      const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
      if (await sidebar.count()) return true;
      const trigger = this.page.locator('[data-testid="sidebar-trigger"]');
      if (await trigger.count()) return true;
      return false;
    } catch {
      return false;
    }
  }
}
