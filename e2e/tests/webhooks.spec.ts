import { test, expect } from '../fixtures/auth.fixture';

test.describe('Webhooks', () => {
  const ts = Date.now();

  test('create webhook and send inbound payload', async ({ apiHelper }) => {
    const board = await apiHelper.createBoard(`WH Board ${ts}`);
    const webhook = await apiHelper.createWebhook(board.id, 'CI/CD webhook');

    expect(webhook.id).toBeTruthy();
    expect(webhook.secret).toBeTruthy();

    // Send inbound webhook with correct secret
    const result = await apiHelper.sendInboundWebhook(
      board.id,
      webhook.id,
      webhook.secret,
      { event: 'build.completed', status: 'success', commit: `abc${ts}` }
    );

    expect(result.status).toBe(200);
    expect(result.data.received).toBe(true);
    expect(result.data.id).toBeTruthy();

    await apiHelper.deleteBoard(board.id);
  });

  test('webhook with invalid secret returns 401', async ({ apiHelper }) => {
    const board = await apiHelper.createBoard(`WH Reject ${ts}`);
    const webhook = await apiHelper.createWebhook(board.id, 'Secret test');

    const result = await apiHelper.sendInboundWebhook(
      board.id,
      webhook.id,
      'wrong-secret-value',
      { event: 'should.fail' }
    );

    expect(result.status).toBe(401);

    await apiHelper.deleteBoard(board.id);
  });

  test('board detail page has Settings button', async ({ apiHelper, page }) => {
    const board = await apiHelper.createBoard(`WH UI Board ${ts}`);

    await page.goto(`/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

    await apiHelper.deleteBoard(board.id);
  });
});
