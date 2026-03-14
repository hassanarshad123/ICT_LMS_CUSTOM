import { test as base, expect, Page } from '@playwright/test';

/**
 * Test accounts matching backend seed data.
 */
export const TEST_ACCOUNTS = {
  admin: { email: 'admin@ict.net.pk', password: 'admin123', role: 'admin' },
  cc: { email: 'cc@ict.net.pk', password: 'cc123456', role: 'course_creator' },
  teacher: { email: 'teacher@ict.net.pk', password: 'teacher123', role: 'teacher' },
  student: { email: 'student@ict.net.pk', password: 'student123', role: 'student' },
} as const;

type RoleKey = keyof typeof TEST_ACCOUNTS;

/**
 * Login helper — fills the login form and submits.
 */
export async function loginAs(page: Page, role: RoleKey): Promise<void> {
  const account = TEST_ACCOUNTS[role];
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"]', account.email);
  await page.fill('input[type="password"], input[name="password"]', account.password);
  await page.click('button[type="submit"]');

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

/**
 * Logout helper — navigates to ensure clean state.
 */
export async function logout(page: Page): Promise<void> {
  // Clear localStorage tokens
  await page.evaluate(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  });
  await page.goto('/login');
}

/**
 * Extended test fixture that provides login helpers.
 */
export const test = base.extend<{
  loginAsAdmin: () => Promise<void>;
  loginAsCC: () => Promise<void>;
  loginAsTeacher: () => Promise<void>;
  loginAsStudent: () => Promise<void>;
}>({
  loginAsAdmin: async ({ page }, use) => {
    await use(async () => loginAs(page, 'admin'));
  },
  loginAsCC: async ({ page }, use) => {
    await use(async () => loginAs(page, 'cc'));
  },
  loginAsTeacher: async ({ page }, use) => {
    await use(async () => loginAs(page, 'teacher'));
  },
  loginAsStudent: async ({ page }, use) => {
    await use(async () => loginAs(page, 'student'));
  },
});

export { expect };
