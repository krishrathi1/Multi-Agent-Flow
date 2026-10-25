import { test, expect } from '../fixtures/auth.fixture';

test.describe('Skills Marketplace', () => {
  const ts = Date.now();

  test('page loads with correct heading and Add Skill button', async ({ page }) => {
    await page.goto('/skills');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Skills Marketplace/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Skill' })).toBeVisible();
  });

  test('create skill via modal', async ({ page }) => {
    await page.goto('/skills');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Skill' }).click();

    // Modal should appear
    const modal = page.locator('div.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Add Skill', exact: true }) });
    await expect(modal).toBeVisible();

    // Fill form
    await page.getByPlaceholder('e.g. GitHub Pull Request Audit').fill(`E2E Skill ${ts}`);
    await page.getByPlaceholder('What does this skill enable agents to do?').fill('Skill created by Playwright E2E test');

    // Select category and risk dropdowns
    await modal.getByRole('button', { name: 'General', exact: true }).click();
    await modal.getByRole('button', { name: 'Coding', exact: true }).click();
    await modal.getByRole('button', { name: 'Low Risk', exact: true }).click();
    await modal.getByRole('button', { name: 'Medium Risk', exact: true }).click();

    // Submit — scoped to modal
    await modal.getByRole('button', { name: 'Add Skill' }).click();

    // Skill should appear in grid
    await expect(page.getByText(`E2E Skill ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('switch between Skills and Skill Packs tabs', async ({ page }) => {
    await page.goto('/skills');
    await page.waitForLoadState('networkidle');

    // Switch to Skill Packs
    await page.getByRole('button', { name: /Skill Packs/ }).click();
    await expect(page.getByPlaceholder('Pack name')).toBeVisible();

    // Switch back to Skills
    await page.getByRole('button', { name: /Skills Directory/ }).click();
    await expect(page.getByRole('button', { name: 'Add Skill' })).toBeVisible();
  });

  test('add skill pack', async ({ page }) => {
    await page.goto('/skills');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Skill Packs/ }).click();

    await page.getByPlaceholder('Pack name').fill(`E2E Pack ${ts}`);
    await page.getByPlaceholder('Git Repository URL').fill(`https://github.com/test/skills-${ts}`);
    await page.getByPlaceholder('Description').fill('E2E test skill pack');

    await page.getByRole('button', { name: 'Register Pack' }).click();

    await expect(page.getByText(`E2E Pack ${ts}`)).toBeVisible({ timeout: 10_000 });
  });
});
