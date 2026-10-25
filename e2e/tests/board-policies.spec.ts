import { test, expect } from '../fixtures/auth.fixture';

test.describe('Board Policies', () => {
  const ts = Date.now();

  test('enable board policies via API', async ({ apiHelper }) => {
    const board = await apiHelper.createBoard(`Policy Board ${ts}`);

    // Enable requireReviewBeforeDone
    const updated = await apiHelper.updateBoard(board.id, {
      requireReviewBeforeDone: true,
      blockStatusChangesWithPendingApproval: true,
      onlyLeadCanChangeStatus: false,
    });

    expect(updated.requireReviewBeforeDone).toBe(true);
    expect(updated.blockStatusChangesWithPendingApproval).toBe(true);
    expect(updated.onlyLeadCanChangeStatus).toBe(false);

    await apiHelper.deleteBoard(board.id);
  });

  test('board detail Settings shows policy toggles', async ({ apiHelper, page }) => {
    const board = await apiHelper.createBoard(`Policy UI ${ts}`);

    await page.goto(`/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    // Open settings panel
    await page.getByRole('button', { name: 'Settings' }).click();

    // Board settings should show toggle for "Require approval for done"
    await expect(page.getByText('Require approval for done')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Settings' })).toBeVisible();

    await apiHelper.deleteBoard(board.id);
  });
});
