import { test, expect } from '../fixtures/auth.fixture';

test.describe('Board Onboarding', () => {
  const ts = Date.now();

  test('start onboarding session via API', async ({ apiHelper }) => {
    const board = await apiHelper.createBoard(`Onboard ${ts}`);

    const session = await apiHelper.startOnboarding(board.id);
    expect(session.id).toBeTruthy();
    expect(session.status).toBeDefined();

    await apiHelper.deleteBoard(board.id);
  });

  test('board detail page loads with kanban', async ({ apiHelper, page }) => {
    const board = await apiHelper.createBoard(`Onboard UI ${ts}`);

    await page.goto(`/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    // Board name visible (use heading to avoid matching both span and h2)
    await expect(page.getByRole('heading', { name: `Onboard UI ${ts}` })).toBeVisible();
    // Kanban columns present
    await expect(page.getByText('Backlog')).toBeVisible();

    await apiHelper.deleteBoard(board.id);
  });
});
