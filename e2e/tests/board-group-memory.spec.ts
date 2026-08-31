import { test, expect } from '../fixtures/auth.fixture';

test.describe('Board Group Memory', () => {
  const ts = Date.now();

  test('create group and add memory via API', async ({ apiHelper }) => {
    const group = await apiHelper.createBoardGroup(`Memory Group ${ts}`);
    expect(group.id).toBeTruthy();

    const mem = await apiHelper.addGroupMemory(
      group.id,
      'Always prioritize security fixes over features',
      ['policy', 'priority']
    );

    expect(mem.id).toBeTruthy();
    expect(mem.content).toBe('Always prioritize security fixes over features');
  });

  test('add multiple memories with different tags', async ({ apiHelper }) => {
    const group = await apiHelper.createBoardGroup(`Multi Mem ${ts}`);

    const mem1 = await apiHelper.addGroupMemory(group.id, 'Use conventional commits', ['convention']);
    const mem2 = await apiHelper.addGroupMemory(group.id, 'Write tests for all new features', ['testing']);

    expect(mem1.id).toBeTruthy();
    expect(mem2.id).toBeTruthy();
    expect(mem1.id).not.toBe(mem2.id);
  });
});
