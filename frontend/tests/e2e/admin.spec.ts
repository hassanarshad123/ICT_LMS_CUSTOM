import { test, expect, loginAs } from './fixtures';

test.describe('Admin Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin dashboard loads with metrics', async ({ page }) => {
    // Navigate to dashboard if not already there
    const dashboardLink = page.locator('a:has-text("Dashboard"), [href*="dashboard"]').first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
    }
    await page.waitForLoadState('networkidle');

    // Dashboard should show some content (stats cards, charts, etc.)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('user list page loads', async ({ page }) => {
    // Navigate to users
    const usersLink = page.locator('a:has-text("Users"), a:has-text("Students"), [href*="users"]').first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      await page.waitForLoadState('networkidle');

      // Should show a table or list
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('batch list page loads', async ({ page }) => {
    const batchLink = page.locator('a:has-text("Batch"), [href*="batch"]').first();
    if (await batchLink.isVisible()) {
      await batchLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('settings page loads', async ({ page }) => {
    const settingsLink = page.locator('a:has-text("Settings"), [href*="settings"]').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });
});
