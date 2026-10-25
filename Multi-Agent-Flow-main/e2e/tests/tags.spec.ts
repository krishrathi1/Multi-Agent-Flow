import { test, expect } from '../fixtures/auth.fixture';

test.describe('Tags', () => {
  const ts = Date.now();

  test('create tag and assign to task, verify on task board', async ({ apiHelper, page }) => {
    const tag = await apiHelper.createTag(`Bug-${ts}`, '#ef4444');
    const task = await apiHelper.createTask(`Tagged Task ${ts}`);
    await apiHelper.assignTags(task.id, [tag.id]);

    // Navigate to task board and verify the task is visible
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(`Tagged Task ${ts}`)).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await apiHelper.deleteTag(tag.id);
    await apiHelper.deleteTask(task.id);
  });

  test('tag CRUD lifecycle via API', async ({ apiHelper }) => {
    // Create
    const tag = await apiHelper.createTag(`CRUD-${ts}`, '#3b82f6');
    expect(tag.id).toBeTruthy();
    expect(tag.name).toBe(`CRUD-${ts}`);

    // Delete
    const status = await apiHelper.deleteTag(tag.id);
    expect(status).toBe(204);
  });
});
