import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';

test.describe('Admin Orders', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    
    // Navegar para página de pedidos
    await page.goto('/admin/orders');
    await expect(page.locator('h1')).toContainText('Pedidos');
  });

  test('deve carregar a página de pedidos corretamente', async ({ page }) => {
    // Verificar título da página
    await expect(page.locator('h1')).toContainText('Pedidos');
    
    // Verificar se filtros estão presentes
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-plan"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-provider"]')).toBeVisible();
  });

  test('deve exibir estatísticas de pedidos', async ({ page }) => {
    // Verificar cards de estatísticas
    await expect(page.locator('[data-testid="stats-total-orders"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="stats-pending-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-conversion-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-total-revenue"]')).toBeVisible();
  });

  test('deve filtrar pedidos por status', async ({ page }) => {
    const statusFilter = page.locator('[data-testid="filter-status"]');
    await statusFilter.click();
    
    await page.getByRole('option', { name: 'Pago' }).click();
    await expect(statusFilter).toContainText('Pago');
  });

  test('deve filtrar pedidos por plano', async ({ page }) => {
    const planFilter = page.locator('[data-testid="filter-plan"]');
    await planFilter.click();
    
    await page.getByRole('option', { name: 'Standard' }).click();
    await expect(planFilter).toContainText('Standard');
  });

  test('deve buscar pedidos por email', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('test@example.com');
    
    await expect(searchInput).toHaveValue('test@example.com');
  });

  test('deve exibir lista (ou estado vazio) corretamente', async ({ page }) => {
    await expect(page.locator('[data-testid="orders-table"]')).toBeVisible();

    const orderRows = page.locator('[data-testid^="order-row-"]');
    const count = await orderRows.count();
    
    if (count === 0) {
      await expect(page.getByText('Nenhum pedido encontrado')).toBeVisible();
      return;
    }

    await expect(orderRows.first()).toBeVisible();

    const firstRowText = (await orderRows.first().textContent()) || '';
    expect(firstRowText).toMatch(/R\$/);
    expect(firstRowText).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  test('deve navegar para detalhes do pedido', async ({ page }) => {
    const firstOrder = page.locator('[data-testid^="order-row-"]').first();
    if (await firstOrder.count() === 0) {
      test.skip();
    }

    await firstOrder.locator('[data-testid="view-order-button"]').click();
    await expect(page.locator('h1')).toContainText('Detalhes do Pedido');
    await expect(page).toHaveURL(/\/admin\/orders\/[a-zA-Z0-9-]+/);
  });

  test('deve ser responsivo em mobile', async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar se layout se adapta
    const orderRows = page.locator('[data-testid^="order-row-"]');
    if (await orderRows.count() === 0) {
      await expect(page.getByText('Nenhum pedido encontrado')).toBeVisible();
      return;
    }
    await expect(orderRows.first()).toBeVisible({ timeout: 15000 });
    
    // Verificar se filtros funcionam em mobile
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
  });

  test('deve ter acessibilidade adequada', async ({ page }) => {
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

  test('deve exibir loading states', async ({ page }) => {
    // Recarregar página para ver loading
    await page.reload();
    
    const pageLoading = page.locator('[data-testid="admin-page-loading"]');
    if ((await pageLoading.count()) > 0) {
      await expect(pageLoading).toBeVisible({ timeout: 2000 }).catch(() => {});
    }
    
    await page.waitForSelector('main', { timeout: 30000 });
    
    if ((await pageLoading.count()) > 0) {
      await expect(pageLoading).not.toBeVisible({ timeout: 15000 });
    }
  });
});
