import { test, expect } from '@playwright/test';

const testEmail = process.env.E2E_TEST_EMAIL || 'test@nexus.local';
const testPassword = process.env.E2E_TEST_PASSWORD || 'TestPass123';

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Enter your password').fill(testPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Enter your password').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Error banner should appear (red background)
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 10_000 });
  });

  test('protected route redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**', { timeout: 10_000 });
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  });

  test('signup form navigates to check-email on success', async ({ page }) => {
    const ts = Date.now();
    // Exercise the form's success handling without sending mail from E2E.
    // The backend's signup and verification behavior is covered by API tests.
    await page.route('**/api/auth/signup', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Verification email sent' }),
      });
    });
    await page.goto('/signup');

    await page.getByPlaceholder('John Doe').fill(`E2E User ${ts}`);
    await page.getByPlaceholder('you@example.com').fill(`e2e-${ts}@test.local`);
    await page.getByPlaceholder('Choose a strong password').fill('E2eTestPass123');
    await page.getByPlaceholder('Acme Inc.').fill(`E2E Org ${ts}`);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL('**/check-email**', { timeout: 15_000 });
  });
});
