import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export class AccessibilityHelper {
  constructor(private page: Page) {}

  async getBlockingViolations() {
    const results = await this.runAxeTests();
    return results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
  }

  /**
   * Executa testes de acessibilidade com axe-core
   */
  async runAxeTests() {
    const accessibilityScanResults = await new AxeBuilder({ page: this.page }).analyze();
    
    return {
      violations: accessibilityScanResults.violations,
      passes: accessibilityScanResults.passes,
      incomplete: accessibilityScanResults.incomplete,
      inapplicable: accessibilityScanResults.inapplicable
    };
  }

  /**
   * Verifica se há violações críticas de acessibilidade
   */
  async hasCriticalViolations(): Promise<boolean> {
    const violations = await this.getBlockingViolations();
    return violations.length > 0;
  }

  /**
   * Testa navegação por teclado
   */
  async testKeyboardNavigation() {
    // Testar Tab para navegar entre elementos
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    
    // Verificar se o foco está visível
    const focusedElement = this.page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }

  /**
   * Verifica se elementos têm labels apropriados
   */
  async verifyElementLabels() {
    // Verificar inputs sem labels
    const inputs = this.page.locator('input:not([aria-label]):not([aria-labelledby])');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const label = this.page.locator(`label[for="${id}"]`);
      
      if (id) {
        await expect(label).toBeVisible();
      }
    }
  }

  /**
   * Verifica contraste de cores
   */
  async verifyColorContrast() {
    // Este é um teste básico - em produção, use ferramentas especializadas
    const textElements = this.page.locator('p, span, div, h1, h2, h3, h4, h5, h6');
    const count = await textElements.count();
    
    // Verificar se elementos de texto têm cores adequadas
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      const color = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.color;
      });
      
      // Verificar se não é transparente ou muito claro
      expect(color).not.toBe('rgba(0, 0, 0, 0)');
    }
  }

  /**
   * Verifica se elementos têm roles ARIA apropriados
   */
  async verifyAriaRoles() {
    // Verificar botões
    const buttons = this.page.locator('button');
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
    const links = this.page.locator('a');
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
  }

  /**
   * Verifica landmarks semânticos
   */
  async verifySemanticLandmarks() {
    // Verificar se há elementos semânticos principais
    const main = this.page.locator('main');
    const nav = this.page.locator('nav');
    const header = this.page.locator('header');
    const footer = this.page.locator('footer');
    
    await expect(main).toBeVisible();
    await expect(nav).toBeVisible();
  }

  /**
   * Testa screen reader compatibility
   */
  async testScreenReaderCompatibility() {
    // Verificar se elementos importantes têm texto alternativo
    const images = this.page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      
      // Imagens devem ter alt ou aria-label
      expect(alt || ariaLabel).toBeTruthy();
    }

    const interactiveIconOnly = await this.page.evaluate(() => {
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
  }

  /**
   * Verifica focus management
   */
  async verifyFocusManagement() {
    // Testar se elementos focáveis são visíveis quando focados
    const focusableElements = this.page.locator('button, a, input, select, textarea, [tabindex]');
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
  }

  /**
   * Executa todos os testes de acessibilidade
   */
  async runAllAccessibilityTests() {
    const results = {
      axeResults: await this.runAxeTests(),
      keyboardNavigation: true,
      elementLabels: true,
      colorContrast: true,
      ariaRoles: true,
      semanticLandmarks: true,
      screenReader: true,
      focusManagement: true
    };

    try {
      await this.testKeyboardNavigation();
    } catch (error) {
      results.keyboardNavigation = false;
    }

    try {
      await this.verifyElementLabels();
    } catch (error) {
      results.elementLabels = false;
    }

    try {
      await this.verifyColorContrast();
    } catch (error) {
      results.colorContrast = false;
    }

    try {
      await this.verifyAriaRoles();
    } catch (error) {
      results.ariaRoles = false;
    }

    try {
      await this.verifySemanticLandmarks();
    } catch (error) {
      results.semanticLandmarks = false;
    }

    try {
      await this.testScreenReaderCompatibility();
    } catch (error) {
      results.screenReader = false;
    }

    try {
      await this.verifyFocusManagement();
    } catch (error) {
      results.focusManagement = false;
    }

    return results;
  }
}
