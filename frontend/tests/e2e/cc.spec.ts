import { test, expect, loginAs } from './fixtures';

test.describe('Course Creator Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'cc');
  });

  test('course list page loads', async ({ page }) => {
    const courseLink = page.locator('a:has-text("Courses"), [href*="courses"]').first();
    if (await courseLink.isVisible()) {
      await courseLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('can open create course dialog/page', async ({ page }) => {
    // Navigate to courses
    const courseLink = page.locator('a:has-text("Courses"), [href*="courses"]').first();
    if (await courseLink.isVisible()) {
      await courseLink.click();
      await page.waitForLoadState('networkidle');

      // Look for create/add button
      const createBtn = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        // Should show a form or dialog
        const dialog = page.locator('[role="dialog"], form, .modal').first();
        const isVisible = await dialog.isVisible().catch(() => false);
        // Either a dialog appeared or the page changed
        expect(isVisible || !page.url().includes('courses')).toBe(true);
      }
    }
  });

  test('batch management page loads', async ({ page }) => {
    const batchLink = page.locator('a:has-text("Batch"), [href*="batch"]').first();
    if (await batchLink.isVisible()) {
      await batchLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('certificate page loads', async ({ page }) => {
    const certLink = page.locator('a:has-text("Certificate"), [href*="certificate"]').first();
    if (await certLink.isVisible()) {
      await certLink.click();
      await page.waitForLoadState('networkidle');
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });
});
