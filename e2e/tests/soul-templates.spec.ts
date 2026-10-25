import { test, expect } from '../fixtures/auth.fixture';

test.describe('Soul Templates', () => {
  const ts = Date.now();

  test('page loads with heading and Create Template button', async ({ page }) => {
    await page.goto('/soul-templates');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Soul Templates/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Template' })).toBeVisible();
  });

  test('create template via modal', async ({ page }) => {
    await page.goto('/soul-templates');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Template' }).click();

    const modal = page.locator('div.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Create Soul Template' }) });
    await expect(modal).toBeVisible();

    await page.getByPlaceholder('e.g. SRE Incident Commander').fill(`E2E Template ${ts}`);
    await modal.getByRole('button', { name: 'General', exact: true }).click();
    await modal.getByRole('button', { name: 'Coding', exact: true }).click();
    await page.getByPlaceholder('Short summary of role').fill('Created by Playwright E2E');
    await page.getByPlaceholder('# Agent Role\n\nInstructions, boundaries, output rules...').fill(
      '# E2E Test Agent\nYou are an E2E test agent.\n\n## Instructions\n- Run tests thoroughly'
    );

    await modal.getByRole('button', { name: 'Create' }).click();

    // Template should appear in the sidebar list
    await expect(page.getByRole('heading', { name: `E2E Template ${ts}` })).toBeVisible({ timeout: 10_000 });
  });

  test('click template to see preview', async ({ apiHelper, page }) => {
    const tmpl = await apiHelper.createSoulTemplate(
      `Preview ${ts}`,
      '# Preview Content\nThis is the E2E preview template.',
      'general'
    );

    await page.goto('/soul-templates');
    await page.waitForLoadState('networkidle');

    // Click template in sidebar (use first() since name appears in sidebar + preview heading)
    await page.getByText(`Preview ${ts}`).first().click();

    // Preview should show content in a <pre> block
    await expect(page.locator('pre')).toContainText('Preview Content');

    // Delete button should be visible in detail panel
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();

    // Cleanup
    await apiHelper.deleteSoulTemplate(tmpl.id);
  });

  test('search for template', async ({ apiHelper, page }) => {
    const tmpl = await apiHelper.createSoulTemplate(
      `SearchableE2E ${ts}`,
      '# Searchable Template',
      'research'
    );

    await page.goto('/soul-templates');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Search templates by name, keyword, or capability...').fill('SearchableE2E');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    await expect(page.getByText(`SearchableE2E ${ts}`)).toBeVisible({ timeout: 10_000 });

    await apiHelper.deleteSoulTemplate(tmpl.id);
  });

  test('delete template from preview', async ({ apiHelper, page }) => {
    const tmpl = await apiHelper.createSoulTemplate(
      `DeleteMe ${ts}`,
      '# To Delete',
      'general'
    );

    await page.goto('/soul-templates');
    await page.waitForLoadState('networkidle');

    // Select the template (first() since name appears in sidebar + preview heading)
    await page.getByText(`DeleteMe ${ts}`).first().click();
    await expect(page.locator('pre')).toContainText('To Delete');

    // Delete it (exact match to avoid matching template names containing "Delete")
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Preview should be cleared (shows placeholder text) and pre block gone
    await expect(page.getByText('Select a template to preview its operating instructions')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('pre')).not.toBeVisible();
  });
});
