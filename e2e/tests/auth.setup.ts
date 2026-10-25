import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.getByPlaceholder('you@example.com').fill('test@nexus.local');
  await page.getByPlaceholder('Enter your password').fill('TestPass123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });

  // Save auth state (includes httpOnly cookies)
  await page.context().storageState({ path: AUTH_FILE });
});
