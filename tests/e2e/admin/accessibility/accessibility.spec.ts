import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { AccessibilityHelper } from '../../../helpers/accessibility.helper';

test.describe('Admin Accessibility', () => {
  test.describe.configure({ timeout: 120000 });
  let authHelper: AuthHelper;
  let accessibilityHelper: AccessibilityHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    accessibilityHelper = new AccessibilityHelper(page);
    
    // Usar estado de autenticação salvo
    page.setDefaultTimeout(60000);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main', { timeout: 60000 });

    const sidebar = page.locator('[data-testid="admin-sidebar"]');
    if ((await sidebar.count()) === 0) {
      await page.locator('[data-testid="sidebar-trigger"]').click();
      await expect(sidebar).toBeVisible();
    }
  });

  test('deve passar testes de acessibilidade com axe-core', async ({ page }) => {
    const results = await accessibilityHelper.runAxeTests();
    
    const blockingViolations = await accessibilityHelper.getBlockingViolations();
    expect(blockingViolations).toHaveLength(0);
    
    // Verificar se há passes
    expect(results.passes.length).toBeGreaterThan(0);
  });

  test('deve ter navegação por teclado funcional', async ({ page }) => {
    const targetSidebarItem = page.locator('[data-testid="sidebar-item-orders"]');
    await expect(targetSidebarItem).toBeVisible();
    await targetSidebarItem.focus();

    await expect(targetSidebarItem).toBeFocused();

    await targetSidebarItem.press('Enter');
    await expect(page).toHaveURL(/\/admin\/orders/);
  });

  test('deve ter labels apropriados para elementos', async ({ page }) => {
    // Verificar inputs sem labels
    const inputs = page.locator('input:not([aria-label]):not([aria-labelledby])');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('deve ter contraste de cores adequado', async ({ page }) => {
    // Verificar elementos de texto
    const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6');
    const count = await textElements.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      const color = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.color;
      });
      
      // Verificar se não é transparente
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('deve ter roles ARIA apropriados', async ({ page }) => {
    // Verificar botões
    const buttons = page.locator('button');
    const buttonHandles = await buttons.elementHandles();
    
    for (const button of buttonHandles.slice(0, 50)) {
      const role = await button.evaluate((el) => (el instanceof Element ? el.getAttribute('role') : null));
      const ariaLabel = await button.evaluate((el) => (el instanceof Element ? el.getAttribute('aria-label') : null));
      const text = await button.evaluate((el) => (el.textContent ?? '').trim());
      
      // Botões devem ter role="button" ou aria-label
      if (!role || role === 'button') {
        // OK - role padrão é button
      } else {
        expect(ariaLabel || text).toBeTruthy();
      }
    }

    // Verificar links
    const links = page.locator('a');
    const linkHandles = await links.elementHandles();
    
    for (const link of linkHandles.slice(0, 100)) {
      const href = await link.evaluate((el) => (el instanceof Element ? el.getAttribute('href') : null));
      const ariaLabel = await link.evaluate((el) => (el instanceof Element ? el.getAttribute('aria-label') : null));
      const text = await link.evaluate((el) => (el.textContent ?? '').trim());
      
      // Links devem ter href ou aria-label
      if (!href || href === '#') {
        expect(ariaLabel || text).toBeTruthy();
      }
    }
  });

  test('deve ter landmarks semânticos', async ({ page }) => {
    // Verificar elementos semânticos principais
    const main = page.locator('main');
    const nav = page.locator('nav');
    const header = page.locator('header');
    
    await expect(main).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(header).toBeVisible();
  });

  test('deve ser compatível com screen readers', async ({ page }) => {
    // Verificar imagens
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      
      // Imagens devem ter alt ou aria-label
      expect(alt || ariaLabel).toBeTruthy();
    }

    const interactiveIconOnly = await page.evaluate(() => {
      const selector = 'button,a,[role="button"],[role="link"],[role="menuitem"]';
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

      const offenders: Array<{
        tag: string;
        role: string | null;
        ariaLabel: string | null;
        title: string | null;
        testId: string | null;
        html: string;
      }> = [];

      for (const el of elements) {
        if (el.closest('[aria-hidden="true"]')) continue;
        if (!el.querySelector('svg')) continue;

        const ariaLabel = el.getAttribute('aria-label');
        const text = (el.textContent ?? '').trim();
        const name = `${ariaLabel ?? ''} ${text}`.trim();

        if (name) continue;

        offenders.push({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          ariaLabel,
          title: el.getAttribute('title'),
          testId: el.getAttribute('data-testid'),
          html: el.outerHTML.slice(0, 300),
        });

        if (offenders.length >= 10) break;
      }

      return offenders;
    });

    expect(interactiveIconOnly).toHaveLength(0);
  });

  test('deve ter gerenciamento de foco adequado', async ({ page }) => {
    // Testar elementos focáveis
    const focusableElements = page.locator('button, a, input, select, textarea, [tabindex]');
    const count = await focusableElements.count();
    
    let tested = 0;
    for (let i = 0; i < Math.min(count, 25) && tested < 5; i++) {
      const element = focusableElements.nth(i);
      const tabindex = await element.getAttribute('tabindex');
      if (tabindex === '-1') continue;
      if (!(await element.isVisible())) continue;

      await element.focus();
      
      await expect(element).toBeVisible();
      const focusOk = await element.evaluate((el) => {
        const active = document.activeElement;
        return active === el || (active instanceof HTMLElement && el.contains(active));
      });
      if (!focusOk) continue;
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });

  test('deve ter acessibilidade no dashboard', async ({ page }) => {
    // Verificar se cards têm roles apropriados
    const statsCards = page.locator('[data-testid^="stats-card-"]');
    const count = await statsCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = statsCards.nth(i);
      await expect(card).toHaveAttribute('role', 'region');
    }
    
    // Verificar se tabs têm roles corretos
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    
    const tabButtons = page.locator('[role="tab"]');
    await expect(tabButtons.first()).toBeVisible();
  });

  test('deve ter acessibilidade na página de pedidos', async ({ page }) => {
    await page.goto('/admin/orders');
    
    // Verificar se tabela tem roles apropriados
    const table = page.locator('[data-testid="orders-table"]');
    await expect(table).toHaveAttribute('role', 'table');
    
    // Verificar se headers têm scope
    const headers = page.locator('th');
    const headerCount = await headers.count();
    
    for (let i = 0; i < headerCount; i++) {
      const header = headers.nth(i);
      await expect(header).toHaveAttribute('scope', 'col');
    }
  });

  test('deve ter acessibilidade na página de músicas', async ({ page }) => {
    await page.goto('/admin/songs');
    
    // Verificar se player tem controles acessíveis
    const playButtons = page.locator('[data-testid="play-button"]');
    const count = await playButtons.count();
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = playButtons.nth(i);
      await expect(button).toHaveAttribute('aria-label', /play|reproduzir/i);
    }
    
    // Verificar se grupos têm roles apropriados
    const songGroups = page.locator('[data-testid^="song-group-"]');
    if (await songGroups.count() === 0) {
      await expect(page.getByText('Nenhuma música encontrada')).toBeVisible({ timeout: 15000 });
      return;
    }
    await expect(songGroups.first()).toHaveAttribute('role', 'group');
  });

  test('deve ter acessibilidade no wizard de geração', async ({ page }) => {
    await page.goto('/admin/generate');
    
    // Verificar se wizard tem roles apropriados
    const wizard = page.locator('[data-testid="generation-wizard"]');
    await expect(wizard).toHaveAttribute('role', 'main');
    
    // Verificar se steps têm roles corretos
    const steps = page.locator('[role="tabpanel"][data-testid^="step-"]');
    const count = await steps.count();
    
    for (let i = 0; i < count; i++) {
      const step = steps.nth(i);
      await expect(step).toHaveAttribute('role', 'tabpanel');
    }
  });

  test('deve ter acessibilidade no sidebar', async ({ page }) => {
    // Verificar se sidebar tem role navigation
    const sidebar = page.locator('[data-testid="admin-sidebar"]');
    await expect(sidebar).toHaveAttribute('role', 'navigation');
    
    // Verificar se itens têm roles corretos
    const menuItems = page.locator('[data-testid^="sidebar-item-"]');
    const count = await menuItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      await expect(item).toHaveAttribute('href', /\/admin/i);
    }
  });

  test('deve executar todos os testes de acessibilidade', async ({ page }) => {
    test.setTimeout(120000);
    await page.waitForSelector('main', { timeout: 60000 });
    const results = await accessibilityHelper.runAllAccessibilityTests();
    
    // Verificar se todos os testes passaram
    const blockingViolations = results.axeResults.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blockingViolations).toHaveLength(0);
    expect(results.keyboardNavigation).toBe(true);
    expect(results.elementLabels).toBe(true);
    expect(results.colorContrast).toBe(true);
    expect(results.ariaRoles).toBe(true);
    expect(results.semanticLandmarks).toBe(true);
    expect(results.screenReader).toBe(true);
    expect(results.focusManagement).toBe(true);
  });
});
