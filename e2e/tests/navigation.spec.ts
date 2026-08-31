import { test, expect } from '../fixtures/auth.fixture';

test.describe('Navigation', () => {
  test('sidebar shows all expected nav links including new features', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');

    // Monitor section
    await expect(sidebar.getByText('Dashboard')).toBeVisible();
    await expect(sidebar.getByText('Activity Feed')).toBeVisible();

    // Manage section — new feature links
    await expect(sidebar.getByText('Skills')).toBeVisible();
    await expect(sidebar.getByText('Soul Templates')).toBeVisible();
    await expect(sidebar.getByText('Custom Fields')).toBeVisible();
    await expect(sidebar.getByText('Boards')).toBeVisible();
    await expect(sidebar.getByText('Task Board')).toBeVisible();
    await expect(sidebar.getByText('Gateways')).toBeVisible();

    // Observe section
    await expect(sidebar.getByText('Metrics & Cost')).toBeVisible();
    await expect(sidebar.getByText('Alerts')).toBeVisible();

    // Account section
    await expect(sidebar.getByText('Settings')).toBeVisible();
  });

  test('clicking new sidebar links navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const navItems = [
      { text: 'Skills', url: '/skills' },
      { text: 'Soul Templates', url: '/soul-templates' },
      { text: 'Custom Fields', url: '/custom-fields' },
      { text: 'Boards', url: '/boards' },
      { text: 'Settings', url: '/settings' },
    ];

    for (const item of navItems) {
      await page.locator('aside').getByText(item.text).first().click();
      await page.waitForURL(`**${item.url}**`, { timeout: 10_000 });
    }
  });

  test('Create Agent button is visible in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('aside').getByText('Create Agent')).toBeVisible();
  });
});
