import { test, expect } from '../fixtures/auth.fixture';

test.describe('Invitations', () => {
  const ts = Date.now();

  test('page loads with invite form', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Workspace Invitations' })).toBeVisible();
    await expect(page.getByPlaceholder('colleague@company.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Invite' })).toBeVisible();
  });

  test('send invitation and see it in list', async ({ page }) => {
    await page.goto('/invitations');
    await page.waitForLoadState('networkidle');

    const email = `invite-${ts}@test.local`;
    await page.getByPlaceholder('colleague@company.com').fill(email);
    await page.getByRole('button', { name: /Member \(Standard Access\)/ }).click();
    await page.getByRole('button', { name: /Admin \(Full Management\)/ }).click();
    await page.getByRole('button', { name: 'Send Invite' }).click();

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

    await page.getByRole('button', { name: /Member \(Standard Access\)/ }).click();
    await expect(page.getByRole('button', { name: /Member \(Standard Access\)/ }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: /Admin \(Full Management\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Viewer \(Read Only\)/ })).toBeVisible();
  });
});
