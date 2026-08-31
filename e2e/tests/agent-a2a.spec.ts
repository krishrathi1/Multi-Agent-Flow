import { test, expect } from '../fixtures/auth.fixture';

test.describe('Agent A2A Toggle', () => {
  test('toggle A2A on and off via API', async ({ apiHelper }) => {
    const agents = await apiHelper.listAgents();
    if (agents.length === 0) {
      test.skip();
      return;
    }

    const agentId = agents[0].id;

    // Enable A2A
    const enabled = await apiHelper.toggleA2A(agentId, true);
    expect(enabled.agentToAgent).toBe(true);

    // Disable A2A
    const disabled = await apiHelper.toggleA2A(agentId, false);
    expect(disabled.agentToAgent).toBe(false);
  });

  test('agent create page loads with expected form fields', async ({ page }) => {
    await page.goto('/agents/new');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Create Agent/ })).toBeVisible();
    await expect(page.getByPlaceholder('My Agent')).toBeVisible();
    await expect(page.getByPlaceholder('What does this agent do?')).toBeVisible();
  });
});
