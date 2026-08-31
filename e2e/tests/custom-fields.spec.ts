import { test, expect } from '../fixtures/auth.fixture';

test.describe('Custom Fields', () => {
  const ts = Date.now();

  test('page loads with heading and Create Field button', async ({ page }) => {
    await page.goto('/custom-fields');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Custom Fields/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Field' })).toBeVisible();
  });

  test('create field definition via UI', async ({ page }) => {
    await page.goto('/custom-fields');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Field' }).click();

    const modal = page.locator('div.fixed.inset-0');
    await expect(modal).toBeVisible();

    await page.getByPlaceholder('Field label').fill(`Score ${ts}`);
    await page.getByPlaceholder('Field key (auto-generated if empty)').fill(`score_${ts}`);

    // Select field type and visibility
    const selects = modal.locator('select');
    await selects.first().selectOption('INTEGER');
    await selects.nth(1).selectOption('ALWAYS');

    await page.getByPlaceholder('Default value (optional)').fill('0');

    await modal.getByRole('button', { name: 'Create' }).click();

    // Field should appear in list
    await expect(page.getByText(`Score ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('attach field to board', async ({ apiHelper, page }) => {
    const board = await apiHelper.createBoard(`CF Board ${ts}`);
    const field = await apiHelper.createCustomField(`CF Test ${ts}`, `cf_${ts}`, 'TEXT');

    await page.goto('/custom-fields');
    await page.waitForLoadState('networkidle');

    // Find the field row using the closest container with role
    const fieldRow = page.locator('main').getByText(`CF Test ${ts}`).locator('xpath=ancestor::tr | ancestor::div[contains(@class,"border")]').first();
    await fieldRow.getByRole('button', { name: 'Attach to Boards' }).click();

    // Modal with board checkboxes
    const modal = page.locator('div.fixed.inset-0');
    await expect(modal.getByText('Attach to Boards')).toBeVisible();

    // Check the board
    await modal.getByText(`CF Board ${ts}`).click();
    await modal.getByRole('button', { name: 'Attach', exact: true }).click();

    // Cleanup
    await apiHelper.deleteCustomField(field.id);
    await apiHelper.deleteBoard(board.id);
  });

  test('delete field definition', async ({ apiHelper, page }) => {
    const field = await apiHelper.createCustomField(`DelField ${ts}`, `del_${ts}`, 'TEXT');

    await page.goto('/custom-fields');
    await page.waitForLoadState('networkidle');

    // Find the field row using the closest container
    const fieldRow = page.locator('main').getByText(`DelField ${ts}`).locator('xpath=ancestor::tr | ancestor::div[contains(@class,"border")]').first();
    await fieldRow.getByRole('button', { name: 'Delete' }).click();

    // Field should disappear
    await expect(page.getByText(`DelField ${ts}`)).not.toBeVisible({ timeout: 5_000 });
  });
});
