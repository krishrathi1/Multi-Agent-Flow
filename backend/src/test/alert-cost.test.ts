import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { acknowledgeEvent, getAlertEvents, getAlertRules, createAlertRule } from '../services/alert.service.js';
import { cleanupTestData, createTestUser } from './setup.js';

describe('token cost alert rules', () => {
  const organizationIds: string[] = [];

  afterAll(async () => {
    await Promise.all(organizationIds.map((organizationId) => cleanupTestData(organizationId)));
  });

  it('creates one event when rolling window spend reaches threshold', async () => {
    const testUser = await createTestUser('cost-alert');
    const organizationId = testUser.organization.id;
    organizationIds.push(organizationId);
    const agent = await prisma.agent.create({
      data: {
        organizationId,
        name: 'cost-alert-agent',
        displayName: 'Cost Alert Agent',
        description: 'Integration test agent',
      },
    });
    const rule = await createAlertRule(organizationId, {
      name: 'E2E token spend threshold',
      condition: 'high_cost',
      threshold: 0.25,
      windowMinutes: 10,
      agentId: agent.id,
    });
    await prisma.tokenUsage.create({
      data: {
        organizationId,
        agentId: agent.id,
        inputTokens: 40,
        outputTokens: 30,
        totalTokens: 70,
        model: 'test-model',
        cost: 0.10,
      },
    });

    const belowThreshold = await getAlertEvents(organizationId, { limit: 100 });
    expect(belowThreshold.filter((event) => event.alertRuleId === rule.id)).toHaveLength(0);

    await prisma.tokenUsage.create({
      data: {
        organizationId,
        agentId: agent.id,
        inputTokens: 80,
        outputTokens: 50,
        totalTokens: 130,
        model: 'test-model',
        cost: 0.20,
      },
    });
    const firstEvents = await getAlertEvents(organizationId, { limit: 100 });
    const matchingEvents = firstEvents.filter((event) => event.alertRuleId === rule.id);
    expect(matchingEvents).toHaveLength(1);
    expect(matchingEvents[0].severity).toBe('WARNING');
    expect(matchingEvents[0].message).toContain('$0.3000');

    const repeatedEvents = await getAlertEvents(organizationId, { limit: 100 });
    expect(repeatedEvents.filter((event) => event.alertRuleId === rule.id)).toHaveLength(1);
    const acknowledged = await acknowledgeEvent(matchingEvents[0].id, organizationId);
    expect(acknowledged.acknowledged).toBe(true);
  });

  it('creates each built-in rule only once during parallel refreshes', async () => {
    const testUser = await createTestUser('concurrent-alert-sync');
    const organizationId = testUser.organization.id;
    organizationIds.push(organizationId);
    await prisma.agent.create({
      data: {
        organizationId,
        name: 'alert-sync-agent',
        displayName: 'Alert Sync Agent',
        description: 'Integration test agent',
      },
    });

    await Promise.all([
      getAlertRules(organizationId),
      getAlertEvents(organizationId),
      getAlertRules(organizationId),
      getAlertEvents(organizationId),
    ]);
    const rules = await prisma.alertRule.findMany({ where: { organizationId } });
    for (const condition of ['HEARTBEAT_MISSED', 'AGENT_OFFLINE', 'RESPONSE_TIME_HIGH', 'STEP_FAILURE']) {
      expect(rules.filter((rule) => rule.condition === condition)).toHaveLength(1);
    }
  });
});
