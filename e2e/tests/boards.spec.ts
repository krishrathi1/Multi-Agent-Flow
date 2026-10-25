import { test, expect } from '../fixtures/auth.fixture';

test.describe('Boards', () => {
  const ts = Date.now();

  test('boards page loads with Create Board button', async ({ page }) => {
    await page.goto('/boards');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Boards', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Board/ })).toBeVisible();
  });

  test('create board via modal', async ({ page }) => {
    await page.goto('/boards');
    await page.waitForLoadState('networkidle');

    // Open create modal
    await page.getByRole('button', { name: /Create Board/ }).first().click();

    // Fill form in modal
    await page.getByPlaceholder('e.g. SRE Production Incident Stream').fill(`E2E Board ${ts}`);
    await page.getByPlaceholder('What is this board designed to coordinate...').fill('Created by Playwright E2E');
    await page.getByPlaceholder('What specific outcome should agents achieve...').fill('Test objectives');

    // Submit — the submit button inside the modal also says "Create Board"
    const modal = page.locator('div.fixed.inset-0');
    await modal.getByRole('button', { name: /Create Board/ }).click();

    // Board card should appear
    await expect(page.getByText(`E2E Board ${ts}`)).toBeVisible({ timeout: 10_000 });
  });

  test('navigate to board detail and see kanban columns', async ({ apiHelper, page }) => {
    const board = await apiHelper.createBoard(`Detail Board ${ts}`);

    await page.goto(`/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: `Detail Board ${ts}` })).toBeVisible();

    // Kanban column headers (use first() to avoid matching task status labels)
    await expect(page.getByText('Backlog').first()).toBeVisible();
    await expect(page.getByText('Assigned').first()).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Review').first()).toBeVisible();
    await expect(page.getByText('Done').first()).toBeVisible();
  });

  test('add task in board detail via + button', async ({ apiHelper, page }) => {
    const board = await apiHelper.createBoard(`Task Add Board ${ts}`);

    await page.goto(`/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    // Click the "+" button in a kanban column (has title="Add task")
    await page.locator('button[title="Add task"]').first().click();

    // Add task modal
    await expect(page.getByText('Add Task to')).toBeVisible();
    await page.getByPlaceholder('Task title...').fill(`PW Task ${ts}`);
    await page.getByRole('button', { name: 'Add Task' }).click();

    // Task should appear
    await expect(page.getByText(`PW Task ${ts}`)).toBeVisible({ timeout: 10_000 });
  });
});
