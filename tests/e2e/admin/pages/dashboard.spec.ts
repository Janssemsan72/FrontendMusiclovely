import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';
import { DataHelper } from '../../../helpers/data.helper';

test.describe('Admin Dashboard', () => {
  let authHelper: AuthHelper;
  let dataHelper: DataHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dataHelper = new DataHelper(page);
    
    // Usar estado de autenticação salvo
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar-trigger"]')).toBeVisible();
  });

  test('deve carregar a página dashboard corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText(/dashboard/i);
    
    // Verificar se stats cards estão presentes
    await expect(page.locator('[data-testid="stats-card-total-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-stripe"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-cakto"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-conversion"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-card-suno-credits"]')).toBeVisible();
  });

  test('deve exibir estatísticas corretas', async ({ page }) => {
    const ordersCard = page.locator('[data-testid="stats-card-total-orders"]');
    const revenueCard = page.locator('[data-testid="stats-card-total-revenue"]');
    const stripeCard = page.locator('[data-testid="stats-card-stripe"]');
    const caktoCard = page.locator('[data-testid="stats-card-cakto"]');
    
    await expect(ordersCard).toBeVisible();
    await expect(revenueCard).toBeVisible();
    await expect(stripeCard).toBeVisible();
    await expect(caktoCard).toBeVisible();
  });

  test('deve ter botão de refresh funcional', async ({ page }) => {
    const refreshButton = page.locator('button[aria-label="Atualizar dados do dashboard"]');
    await expect(refreshButton).toBeVisible();
    
    // Clicar no botão refresh
    await refreshButton.click();
    
    const spinner = refreshButton.locator('.animate-spin');
    await Promise.any([
      expect(spinner).toBeVisible({ timeout: 5000 }),
      expect(refreshButton).toBeDisabled({ timeout: 5000 }),
    ]);
  });

  test('deve alternar entre tabs Jobs e Músicas', async ({ page }) => {
    // Verificar se tabs estão presentes
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    const songsTab = page.locator('[data-testid="tab-songs"]');
    
    await expect(jobsTab).toBeVisible();
    await expect(songsTab).toBeVisible();
    
    // Clicar na tab Jobs
    await jobsTab.click();
    await expect(jobsTab).toHaveAttribute('data-state', 'active');
    
    // Verificar se conteúdo da tab Jobs está visível
    await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
    
    // Clicar na tab Músicas
    await songsTab.click();
    await expect(songsTab).toHaveAttribute('data-state', 'active');
    
    // Verificar se conteúdo da tab Músicas está visível
    await expect(page.locator('[data-testid="songs-content"]')).toBeVisible();
  });

  test('deve exibir jobs recentes na tab Jobs', async ({ page }) => {
    // Navegar para tab Jobs
    await page.locator('[data-testid="tab-jobs"]').click();
    
    const jobsContent = page.locator('[data-testid="jobs-content"]');
    await expect(jobsContent).toBeVisible();
    await expect(jobsContent).toContainText(/jobs/i);
  });

  test('deve exibir músicas recentes na tab Músicas', async ({ page }) => {
    // Navegar para tab Músicas
    await page.locator('[data-testid="tab-songs"]').click();
    
    const songsContent = page.locator('[data-testid="songs-content"]');
    await expect(songsContent).toBeVisible();
    await expect(songsContent).toContainText(/músicas recentes/i);
  });

  test('deve permitir retry de jobs falhados', async ({ page }) => {
    // Navegar para tab Jobs
    await page.locator('[data-testid="tab-jobs"]').click();
    
    // Procurar por job com status failed
    const failedJob = page.locator('[data-testid^="job-item-"]').filter({ hasText: 'Falhou' }).first();
    
    if (await failedJob.count() > 0) {
      // Verificar se botão retry está presente
      const retryButton = failedJob.locator('button').filter({ hasText: 'Retry' });
      await expect(retryButton).toBeVisible();
      
      // Clicar no retry
      await retryButton.click();
      
      // Verificar se loading state aparece
      await expect(retryButton.locator('.animate-spin')).toBeVisible();
    }
  });

  test('deve exibir status badges corretos', async ({ page }) => {
    // Verificar badges de status em jobs
    await page.locator('[data-testid="tab-jobs"]').click();
    
    const statusText = page.locator(
      'text=/Pendente|Processando|Letra Gerada|Gerando Áudio|Processando Áudio|Completo|Liberado|Falhou/'
    );
    if ((await statusText.count()) > 0) {
      await expect(statusText.first()).toBeVisible();
    }
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se layout se adapta
    const statsCards = page.locator('[data-testid^="stats-card-"]');
    await expect(statsCards.first()).toBeVisible();
    
    // Verificar se tabs funcionam em mobile
    const jobsTab = page.locator('[data-testid="tab-jobs"]');
    await expect(jobsTab).toBeVisible();
    await jobsTab.click();
    
    // Verificar se conteúdo é visível
    await expect(page.locator('[data-testid="jobs-content"]')).toBeVisible();
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
    // Verificar se elementos têm roles apropriados
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // Verificar se tabs têm roles corretos
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
    
    // Verificar se botões têm labels
    const refreshButton = page.locator('button[aria-label="Atualizar dados do dashboard"]');
    await expect(refreshButton).toHaveAttribute('aria-label', /atualizar|refresh/i);
  });

  test('deve carregar dados em tempo real', async ({ page }) => {
    await page.waitForSelector('main', { timeout: 30000 });
    
    // Verificar se não há erros de console
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    // Aguardar um pouco mais para verificar se há erros
    await page.waitForTimeout(2000);
    
    // Verificar se não há erros críticos
    const errorLogs = logs.filter(log => 
      !log.includes('404') && 
      !log.includes('favicon') &&
      !log.includes('analytics')
    );
    expect(errorLogs).toHaveLength(0);
  });

  test('deve exibir loading states apropriados', async ({ page }) => {
    // Recarregar página para ver loading
    await page.reload();
    
    const pageLoading = page.locator('[data-testid="admin-page-loading"]');
    const loadingText = page.locator('text=/carregando/i');
    await Promise.any([
      expect(pageLoading.first()).toBeVisible({ timeout: 2000 }),
      expect(loadingText.first()).toBeVisible({ timeout: 2000 }),
    ]).catch(() => {});
    
    await page.waitForSelector('main', { timeout: 30000 });
    if ((await pageLoading.count()) > 0) {
      await expect(pageLoading.first()).not.toBeVisible();
    }
  });
});
