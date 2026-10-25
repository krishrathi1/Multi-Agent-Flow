import { test, expect } from '../fixtures/auth.fixture';

test.describe('Navigation', () => {
  test('sidebar exposes the current application sections', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    for (const label of [
      'Dashboard', 'Production Blocks', 'Fleet Controls', 'Mother Chat',
      'Task Board', 'Boards', 'Automation Hub', 'Approvals & Audit',
      'Network Graph', 'Live Activity', 'Run History', 'Custom Fields',
      'Metrics & Cost', 'Code Intelligence', 'Prompt Lab', 'Gateways',
      'MCP Hub & Tools', 'Skills Library', 'Alerts & Incidents',
    ]) {
      await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('feature links navigate to their routes', async ({ page }) => {
    await page.goto('/dashboard');
    const links = [
      { label: 'Skills Library', path: '/skills' },
      { label: 'Custom Fields', path: '/custom-fields' },
      { label: 'Boards', path: '/boards' },
      { label: 'MCP Hub & Tools', path: '/mcp' },
      { label: 'Alerts & Incidents', path: '/alerts' },
    ];
    for (const link of links) {
      await page.locator('aside').getByText(link.label, { exact: true }).click();
      await page.waitForURL(`**${link.path}`);
    }
  });

  test('agent creation route loads its form', async ({ page }) => {
    await page.goto('/agents/new');
    await expect(page.getByRole('heading', { name: 'Create Agent' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Agent/ }).first()).toBeVisible();
  });

  test('account menu links to settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('header button[aria-haspopup="menu"]').last().click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await page.waitForURL('**/settings');
  });
});
