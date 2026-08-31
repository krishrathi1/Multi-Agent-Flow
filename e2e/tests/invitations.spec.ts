import { test, expect } from '../fixtures/auth.fixture';

test.describe('Invitations', () => {
  const ts = Date.now();

  test('page loads with invite form', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Invitations/ })).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible();
  });

  test('send invitation and see it in list', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');

    const email = `invite-${ts}@test.local`;
    await page.getByPlaceholder('Email address').fill(email);
    await page.locator('select').selectOption('ADMIN');
    await page.getByRole('button', { name: 'Invite' }).click();

    // Invite should appear in the list
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  });

  test('revoke invitation', async ({ apiHelper, page }) => {
    const email = `revoke-${ts}@test.local`;
    await apiHelper.createInvite(email, 'VIEWER');

    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');

    // Find the invite row using the closest container
    await expect(page.getByText(email)).toBeVisible();
    const inviteRow = page.locator('main').getByText(email).locator('xpath=ancestor::tr | ancestor::div[contains(@class,"border")]').first();
    await inviteRow.getByRole('button', { name: 'Revoke' }).click();

    // After revoking, status should change (Revoke button disappears)
    await expect(inviteRow.getByRole('button', { name: 'Revoke' })).not.toBeVisible({ timeout: 5_000 });
  });

  test('role dropdown has all options', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');

    const roleSelect = page.locator('select');
    await expect(roleSelect.locator('option[value="MEMBER"]')).toBeAttached();
    await expect(roleSelect.locator('option[value="ADMIN"]')).toBeAttached();
    await expect(roleSelect.locator('option[value="VIEWER"]')).toBeAttached();
  });
});
