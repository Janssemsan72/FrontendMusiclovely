import { Page, expect } from '@playwright/test';

export class NavigationHelper {
  constructor(private page: Page) {}

  private async ensureSidebarOpenForMobile() {
    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    if ((await sidebar.count()) > 0 && (await sidebar.first().isVisible())) return;

    const trigger = this.page.locator('[data-testid="sidebar-trigger"]');
    if ((await trigger.count()) > 0) {
      await trigger.first().waitFor({ state: 'visible', timeout: 15000 });
      await trigger.first().scrollIntoViewIfNeeded();
      await trigger.first().click();
      await sidebar.first().waitFor({ state: 'visible', timeout: 15000 });
    }
  }

  private async closeSidebarForMobileIfOpen() {
    const isMobile = await this.page.evaluate(() => window.innerWidth < 768);
    if (!isMobile) return;

    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    if ((await sidebar.count()) === 0) return;
    if (!(await sidebar.first().isVisible())) return;

    await this.page.keyboard.press('Escape');
    await sidebar.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => void 0);
  }

  private getMenuItemPath(pageName: string) {
    const menuItems = {
      dashboard: '/admin',
      'quiz-metrics': '/admin/quiz-metrics',
      orders: '/admin/orders',
      songs: '/admin/songs',
      generate: '/admin/generate',
      lyrics: '/admin/lyrics',
      releases: '/admin/releases',
      financial: '/admin/financial',
      collaborators: '/admin/collaborators',
      emails: '/admin/emails',
      'email-logs': '/admin/email-logs',
      media: '/admin/media',
      'example-tracks': '/admin/example-tracks',
      logs: '/admin/logs',
      settings: '/admin/settings',
    };

    return menuItems[pageName as keyof typeof menuItems];
  }

  /**
   * Navega para uma página específica do admin
   */
  async navigateToAdminPage(pageName: string) {
    const url = this.getMenuItemPath(pageName);
    if (!url) {
      throw new Error(`Página admin não encontrada: ${pageName}`);
    }

    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForSelector('main', { timeout: 20000 });
  }

  /**
   * Clica em um item do sidebar
   */
  async clickSidebarItem(itemName: string) {
    await this.ensureSidebarOpenForMobile();
    const item = this.page.locator(`[data-testid="sidebar-item-${itemName}"]`);
    const expectedPath = this.getMenuItemPath(itemName);
    await item.first().waitFor({ state: 'visible', timeout: 15000 });
    await item.first().scrollIntoViewIfNeeded().catch(() => void 0);
    await Promise.all([
      expectedPath
        ? this.page.waitForFunction(
            (path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`),
            expectedPath,
            { timeout: 20000 }
          )
        : Promise.resolve(),
      item.first().click({ timeout: 15000, force: true }),
    ]);

    await this.page.waitForSelector('main', { timeout: 20000 });
  }

  /**
   * Verifica se o sidebar está visível
   */
  async isSidebarVisible(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="admin-sidebar"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Alterna o estado do sidebar (collapse/expand)
   */
  async toggleSidebar() {
    const isMobile = await this.page.evaluate(() => window.innerWidth < 768);
    if (isMobile) {
      const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
      if ((await sidebar.count()) > 0 && (await sidebar.first().isVisible())) {
        await this.closeSidebarForMobileIfOpen();
        await this.page.waitForTimeout(300);
        return;
      }
    }

    const trigger = this.page.locator('[data-testid="sidebar-trigger"]');
    await trigger.first().waitFor({ state: 'visible', timeout: 15000 });
    await trigger.first().scrollIntoViewIfNeeded();
    await trigger.first().click();
    await this.page.waitForTimeout(300); // Aguardar animação
  }

  /**
   * Verifica se o sidebar está colapsado
   */
  async isSidebarCollapsed(): Promise<boolean> {
    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    const width = await sidebar.evaluate(el => el instanceof HTMLElement ? el.offsetWidth : 0);
    return width < 200; // Sidebar colapsado tem largura menor
  }

  /**
   * Verifica se um item do menu está ativo
   */
  async isMenuItemActive(itemName: string): Promise<boolean> {
    await this.ensureSidebarOpenForMobile();
    const item = this.page.locator(`[data-testid="sidebar-item-${itemName}"]`);
    const classes = await item.getAttribute('class');
    return classes?.includes('active') || classes?.includes('bg-primary') || false;
  }

  /**
   * Navega usando o sidebar
   */
  async navigateViaSidebar(itemName: string) {
    await this.clickSidebarItem(itemName);

    const isMobile = await this.page.evaluate(() => window.innerWidth < 768);
    if (!isMobile) {
      await expect(this.page.locator(`[data-testid="sidebar-item-${itemName}"]`))
        .toHaveClass(/active|bg-primary/);
    }
  }

  /**
   * Verifica se está na página correta
   */
  async isOnPage(expectedPath: string): Promise<boolean> {
    const currentUrl = this.page.url();
    return currentUrl.includes(expectedPath);
  }

  /**
   * Aguarda carregamento completo da página
   */
  async waitForPageLoad() {
    await this.page.waitForSelector('main', { timeout: 20000 });
  }

  /**
   * Verifica se o breadcrumb está correto
   */
  async verifyBreadcrumb(expectedItems: string[]) {
    const breadcrumb = this.page.locator('[data-testid="breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
    
    for (const item of expectedItems) {
      await expect(breadcrumb.locator(`text=${item}`)).toBeVisible();
    }
  }

  /**
   * Testa navegação mobile (fechar sidebar ao clicar)
   */
  async testMobileNavigation(itemName: string) {
    // Simular viewport mobile
    await this.page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se sidebar está fechado inicialmente
    const sidebar = this.page.locator('[data-testid="admin-sidebar"]');
    if (await sidebar.isVisible()) {
      await this.closeSidebarForMobileIfOpen();
    }
    await expect(sidebar).not.toBeVisible();
    
    // Abrir sidebar
    const trigger = this.page.locator('[data-testid="sidebar-trigger"]');
    await trigger.first().waitFor({ state: 'visible', timeout: 15000 });
    await trigger.first().scrollIntoViewIfNeeded();
    await trigger.first().click();
    await expect(sidebar).toBeVisible();
    
    // Clicar em item e verificar se sidebar fecha
    await this.clickSidebarItem(itemName);
    await this.page.waitForTimeout(500);
    
    // Em mobile, sidebar deve fechar após navegação
    await expect(sidebar).not.toBeVisible();
  }

  /**
   * Verifica todos os itens do menu
   */
  async verifyAllMenuItems() {
    const expectedItems = [
      'dashboard', 'orders', 'songs', 'generate', 'lyrics', 
      'releases', 'emails', 'media', 'example-tracks', 'logs', 'settings'
    ];

    for (const item of expectedItems) {
      const menuItem = this.page.locator(`[data-testid="sidebar-item-${item}"]`);
      await expect(menuItem).toBeVisible();
    }
  }

  /**
   * Verifica ícones do menu
   */
  async verifyMenuIcons() {
    const menuItems = this.page.locator('[data-testid^="sidebar-item-"]');
    const count = await menuItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      const icon = item.locator('svg');
      await expect(icon).toBeVisible();
    }
  }
}
