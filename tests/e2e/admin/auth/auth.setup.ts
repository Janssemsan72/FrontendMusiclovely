import { test as setup, expect } from '@playwright/test';
import { AuthHelper } from '../../../helpers/auth.helper';

const authFile = 'tests/fixtures/auth.json';

setup('authenticate as admin', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  
  // Realizar login como admin
  await authHelper.loginAsAdmin();
  
  // Verificar se login foi bem-sucedido
  await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
  
  // Salvar estado de autenticação
  await page.context().storageState({ path: authFile });
});
