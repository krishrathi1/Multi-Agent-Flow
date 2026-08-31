import { prisma } from '../lib/prisma.js';
import { afterAll, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

beforeAll(async () => {
  // Verify DB connection gracefully
  try {
    if (process.env.DATABASE_URL) {
      await prisma.$connect();
    }
  } catch {
    // DB not running in isolated test environment
  }
});

afterAll(async () => {
  try {
    if (process.env.DATABASE_URL) {
      await prisma.$disconnect();
    }
  } catch {
    // Ignore disconnect error
  }
});

/**
 * Helper to clean up test data created during tests.
 * Call in afterEach or afterAll to keep the DB clean.
 */
export async function cleanupTestData(orgId: string) {
  // Delete in order respecting foreign key constraints
  await prisma.approvalTaskLink.deleteMany({ where: { approval: { board: { organizationId: orgId } } } });
  await prisma.approval.deleteMany({ where: { board: { organizationId: orgId } } });
  await prisma.boardMemory.deleteMany({ where: { board: { organizationId: orgId } } });
  await prisma.taskDependency.deleteMany({
    where: { dependentTask: { organizationId: orgId } },
  });
  await prisma.mcpTool.deleteMany({
    where: { mcpServer: { agent: { organizationId: orgId } } },
  });
  await prisma.mcpServer.deleteMany({
    where: { agent: { organizationId: orgId } },
  });
  await prisma.command.deleteMany({ where: { organizationId: orgId } });
  await prisma.alertEvent.deleteMany({ where: { organizationId: orgId } });
  await prisma.alertRule.deleteMany({ where: { organizationId: orgId } });
  await prisma.metricSnapshot.deleteMany({ where: { organizationId: orgId } });
  await prisma.tokenUsage.deleteMany({ where: { organizationId: orgId } });
  await prisma.session.deleteMany({ where: { organizationId: orgId } });
  await prisma.message.deleteMany({
    where: { thread: { organizationId: orgId } },
  });
  await prisma.thread.deleteMany({ where: { organizationId: orgId } });
  await prisma.task.deleteMany({ where: { organizationId: orgId } });
  await prisma.activity.deleteMany({ where: { organizationId: orgId } });
  await prisma.agent.deleteMany({ where: { organizationId: orgId } });
  await prisma.board.deleteMany({ where: { organizationId: orgId } });
  await prisma.boardGroup.deleteMany({ where: { organizationId: orgId } });
  await prisma.gateway.deleteMany({ where: { organizationId: orgId } });
  await prisma.llmProvider.deleteMany({ where: { organizationId: orgId } });
  await prisma.usageCredit.deleteMany({ where: { organizationId: orgId } });
  await prisma.orgApiKey.deleteMany({ where: { organizationId: orgId } });
  await prisma.orgMemberBoardAccess.deleteMany({
    where: { member: { organizationId: orgId } },
  });
  await prisma.orgInviteBoardAccess.deleteMany({
    where: { invite: { organizationId: orgId } },
  });
  await prisma.orgInvite.deleteMany({ where: { organizationId: orgId } });
  await prisma.emailVerification.deleteMany({
    where: { user: { memberships: { some: { organizationId: orgId } } } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { memberships: { some: { organizationId: orgId } } } },
  });
  await prisma.orgMember.deleteMany({ where: { organizationId: orgId } });
  // Find users that only belong to this org
  const users = await prisma.user.findMany({
    where: { memberships: { none: {} } },
  });
  if (users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  }
  await prisma.organization.deleteMany({ where: { id: orgId } });
}

const TEST_PASSWORD = 'TestPass123!';

/**
 * Create a pre-verified test user + org + membership, then login to get tokens.
 * This bypasses the email verification flow so tests work without SMTP.
 */
export async function createTestUser(suffix = '') {
  const ts = Date.now();
  const email = `test${suffix}-${ts}@nexus-test.local`;
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 4); // low rounds for speed

  const slug = `test-org-${suffix || ts}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let finalSlug = slug;
  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    finalSlug = `${slug}-${randomBytes(3).toString('hex')}`;
  }

  // Create user (pre-verified), org, and membership in a transaction
  const { user, organization } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: `Test User ${suffix}`,
        emailVerified: true,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: `Test Org ${suffix || ts}`,
        slug: finalSlug,
      },
    });

    await tx.orgMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
        allBoardsRead: true,
        allBoardsWrite: true,
      },
    });

    return { user, organization };
  });

  // Login to get tokens
  const { login } = await import('../services/auth.service.js');
  const loginResult = await login({ email, password: TEST_PASSWORD });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    accessToken: loginResult.accessToken,
    refreshToken: loginResult.refreshToken,
  };
}
