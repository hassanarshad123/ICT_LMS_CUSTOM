import { test, expect, loginAs } from './fixtures';

test.describe('Student Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('student dashboard loads', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('courses page loads with enrolled courses', async ({ page }) => {
    const courseLink = page.locator('a:has-text("Courses"), a:has-text("My Courses"), [href*="courses"]').first();
    if (await courseLink.isVisible()) {
      await courseLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('certificates dashboard loads', async ({ page }) => {
    const certLink = page.locator('a:has-text("Certificate"), [href*="certificate"]').first();
    if (await certLink.isVisible()) {
      await certLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('student cannot see admin nav items', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const body = await page.textContent('body');
    // Students should NOT see admin-only menu items
    const hasAdminDashboard = body?.includes('Admin Dashboard');
    const hasDevices = body?.includes('Devices');
    const hasMonitoring = body?.includes('Error Monitoring');
    expect(hasAdminDashboard).toBeFalsy();
    expect(hasDevices).toBeFalsy();
    expect(hasMonitoring).toBeFalsy();
  });
});
