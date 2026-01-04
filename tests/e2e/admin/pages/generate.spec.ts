import { test, expect, type Locator, type Page } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';

test.describe('Admin Generate - Geração Manual', () => {
  let authHelper: AuthHelper;
  test.setTimeout(120000);

  const fillRequiredStep1Fields = async (page: Page, email: string) => {
    const emailInput = page.locator('[data-testid="input-customer-email"]');
    const aboutWhoInput = page.locator('[data-testid="input-about-who"]');
    const styleInput = page.locator('[data-testid="input-style"]');
    const toneInput = page.locator('[data-testid="input-tone"]');

    const commitFill = async (locator: Locator, value: string) => {
      await locator.scrollIntoViewIfNeeded();
      await expect(locator).toBeVisible({ timeout: 15000 });
      await expect(locator).toBeEnabled({ timeout: 15000 });
      await locator.click({ clickCount: 3 });
      await locator.fill(value);
      await locator.press('Tab');
    };

    await commitFill(emailInput, email);
    await commitFill(aboutWhoInput, 'Minha mãe');
    await commitFill(styleInput, 'Sertanejo');
    await commitFill(toneInput, 'Romântico');
  };

  const submitStep1 = async (page: Page) => {
    const submitButton = page.locator('[data-testid="step-1-submit"]');
    await submitButton.scrollIntoViewIfNeeded();
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await page.locator('[data-testid="step-1"] form').dispatchEvent('submit');
    await expect(submitButton).toBeDisabled({ timeout: 10000 });
  };

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    
    await authHelper.loginAsAdmin();
    const wizard = page.locator('[data-testid="generation-wizard"]');
    const step1 = page.locator('[data-testid="step-1"]');

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto('/admin/generate', { waitUntil: 'domcontentloaded' });
        await expect(wizard).toBeVisible({ timeout: 60000 });
        await expect(step1).toBeVisible({ timeout: 60000 });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  });

  test('deve carregar a página de geração corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText('Geração Manual');
    
    // Verificar se wizard está presente
    await expect(page.locator('[data-testid="generation-wizard"]')).toBeVisible();
    
    // Verificar se está no step 1
    await expect(page.locator('[data-testid="step-1"]')).toBeVisible();
  });

  test('deve exibir timeline de progresso', async ({ page }) => {
    // Verificar se timeline está presente
    const timeline = page.locator('[data-testid="generation-timeline"]');
    await expect(timeline).toBeVisible();
    
    // Verificar se steps estão presentes
    await expect(timeline.locator('[data-testid="timeline-step-1"]')).toBeVisible();
    await expect(timeline.locator('[data-testid="timeline-step-2"]')).toBeVisible();
    await expect(timeline.locator('[data-testid="timeline-step-3"]')).toBeVisible();
  });

  test('deve preencher formulário do step 1 corretamente', async ({ page }) => {
    await fillRequiredStep1Fields(page, 'test@example.com');
    
    // Submeter formulário
    await submitStep1(page);
    
    // Verificar se avançou para step 2
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="step-1"]')).not.toBeVisible();
  });

  test('deve permitir editar letras geradas', async ({ page }) => {
    await fillRequiredStep1Fields(page, 'test@example.com');
    await submitStep1(page);
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 20000 });

    await page.locator('[data-testid="toggle-edit-lyrics"]').click();
    const firstVerse = page.locator('[data-testid="lyrics-verse-0"]');
    await expect(firstVerse).toBeVisible();
    await firstVerse.fill('Nova letra editada pelo usuário');
    await expect(firstVerse).toHaveValue('Nova letra editada pelo usuário');
  });

  test('deve avançar para step 3 após aprovar letras', async ({ page }) => {
    await fillRequiredStep1Fields(page, 'test@example.com');
    await submitStep1(page);
    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 30000 });

    await page.locator('[data-testid="approve-lyrics-button"]').click();
    await expect(page.locator('[data-testid="step-3"]')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="generated-audio"]')).toBeVisible({ timeout: 60000 });
  });

  test('deve exibir estimativa de custos', async ({ page }) => {
    await expect(page.getByText('Estimativa de Custos')).toBeVisible();
    await expect(page.getByText('Total Estimado:')).toBeVisible();
  });

  test('deve exibir logs de geração', async ({ page }) => {
    // Verificar se painel de logs está presente
    const logsPanel = page.locator('[data-testid="generation-logs"]');
    await expect(logsPanel).toBeVisible();
    
    // Verificar se logs são exibidos durante geração
    await fillRequiredStep1Fields(page, 'test@example.com');
    await submitStep1(page);

    await expect(page.locator('[data-testid="step-2"]')).toBeVisible({ timeout: 30000 });
    
    // Verificar se logs aparecem
    const logEntries = page.locator('[data-testid^="log-entry-"]');
    await expect(logEntries.first()).toBeVisible({ timeout: 30000 });
  });

  test('deve exibir status da API Suno', async ({ page }) => {
    await expect(page.getByText('Status da Criação de Música')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Testar Conexão Agora' })).toBeVisible();
  });

  test('deve ter modo debug funcional', async ({ page }) => {
    // Verificar se toggle de debug está presente
    const debugToggle = page.locator('[data-testid="debug-mode-toggle"]');
    await expect(debugToggle).toBeVisible();
    
    // Ativar modo debug
    await debugToggle.click();
    
    // Verificar se painel de debug aparece
    const debugPanel = page.locator('[data-testid="debug-panel"]');
    await expect(debugPanel).toBeVisible();
    
    // Verificar se informações de debug são exibidas
    await expect(debugPanel.locator('[data-testid="debug-info"]')).toBeVisible();
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se wizard se adapta
    await expect(page.locator('[data-testid="generation-wizard"]')).toBeVisible();
    
    // Verificar se formulário funciona em mobile
    await page.fill('[data-testid="input-customer-email"]', 'test@example.com');
    await page.fill('[data-testid="input-about-who"]', 'Minha mãe');
    await page.fill('[data-testid="input-style"]', 'Sertanejo');
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar se wizard tem roles apropriados
    const wizard = page.locator('[data-testid="generation-wizard"]');
    await expect(wizard).toHaveAttribute('role', 'main');
    
    // Verificar se steps têm roles corretos
    const step1 = page.locator('[data-testid="step-1"]');
    await expect(step1).toHaveAttribute('role', 'tabpanel');
  });

  test('deve exibir loading states apropriados', async ({ page }) => {
    // Verificar loading no step 1
    await fillRequiredStep1Fields(page, 'test@example.com');
    
    const submitButton = page.locator('[data-testid="step-1-submit"]');
    await submitStep1(page);
    
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText('Gerando Letra...');
  });

  test('deve validar formato de email', async ({ page }) => {
    await fillRequiredStep1Fields(page, 'email-invalido');
    
    const submitButton = page.locator('[data-testid="step-1-submit"]');
    await submitButton.click();
    
    await expect(page.locator('[data-testid="step-1"]')).toBeVisible();
  });
});
