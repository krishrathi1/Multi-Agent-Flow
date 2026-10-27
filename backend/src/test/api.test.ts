import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { cleanupTestData, createTestUser } from './setup.js';

// Mock email sending so signup tests don't require SMTP
vi.mock('../lib/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Import services
import * as authService from '../services/auth.service.js';
import * as agentService from '../services/agent.service.js';
import * as taskService from '../services/task.service.js';
import * as boardService from '../services/board.service.js';
import * as approvalService from '../services/approval.service.js';
import { generateAgentToken } from '../routes/agent-api.js';
import { createHash } from 'crypto';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('MyceliumOps Backend Integration Tests', () => {
  let orgId: string;
  let userId: string;
  let accessToken: string;
  let refreshToken: string;
  let testEmail: string;

  beforeAll(async () => {
    const result = await createTestUser('integration');
    orgId = result.organization.id;
    userId = result.user.id;
    accessToken = result.accessToken;
    refreshToken = result.refreshToken;
    testEmail = result.user.email;
  });

  afterAll(async () => {
    await cleanupTestData(orgId);
  });

  // ─── Auth Service Tests ─────────────────────────────────────────────────────

  describe('Auth', () => {
    // Track org IDs created in auth tests so we can clean them up
    const authTestOrgIds: string[] = [];

    afterAll(async () => {
      for (const id of authTestOrgIds) {
        try {
          await cleanupTestData(id);
        } catch {
          // Ignore cleanup errors for already-deleted orgs
        }
      }
    });

    it('signup: creates user, org, membership, and requires email verification', async () => {
      const ts = Date.now();
      const result = await authService.signup({
        email: `auth-signup-${ts}@nexus-test.local`,
        password: 'SecurePass456!',
        name: 'Signup Test User',
        orgName: `Signup Test Org ${ts}`,
      });

      authTestOrgIds.push(result.organization.id);

      // User is returned correctly
      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe(`auth-signup-${ts}@nexus-test.local`);
      expect(result.user.name).toBe('Signup Test User');

      // Organization is returned correctly
      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBeDefined();
      expect(result.organization.name).toBe(`Signup Test Org ${ts}`);
      expect(result.organization.slug).toBeDefined();
      expect(result.organization.slug.length).toBeGreaterThan(0);

      // Signup now returns requiresVerification instead of tokens
      expect(result.requiresVerification).toBe(true);

      // Verify the membership was created in the DB
      const membership = await prisma.orgMember.findFirst({
        where: { userId: result.user.id, organizationId: result.organization.id },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe('OWNER');

      // Verify the user is NOT yet email-verified
      const user = await prisma.user.findUnique({ where: { id: result.user.id } });
      expect(user!.emailVerified).toBe(false);

      // Verify a verification token was stored in the DB
      const verificationToken = await prisma.emailVerification.findFirst({
        where: { userId: result.user.id },
      });
      expect(verificationToken).not.toBeNull();
      expect(verificationToken!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('signup: rejects duplicate email with an error', async () => {
      // Use the email from the beforeAll setup user
      await expect(
        authService.signup({
          email: testEmail,
          password: 'AnotherPass123!',
          name: 'Duplicate User',
          orgName: 'Dup Org',
        })
      ).rejects.toThrow('Email already in use');
    });

    it('login: returns tokens for valid credentials', async () => {
      const result = await authService.login({
        email: testEmail,
        password: 'TestPass123!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe(testEmail);

      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBe(orgId);

      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
    });

    it('login: rejects wrong password', async () => {
      await expect(
        authService.login({
          email: testEmail,
          password: 'WrongPassword999!',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('login: rejects non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent-user@nexus-test.local',
          password: 'SomePass123!',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('refresh: rotates tokens and returns new pair', async () => {
      // Create a dedicated user for this test to avoid token hash collisions
      const refreshUser = await createTestUser('refresh-rotate');
      authTestOrgIds.push(refreshUser.organization.id);

      // The signup already gave us a valid refresh token
      const originalRefresh = refreshUser.refreshToken;

      // Wait 1.1s so JWT iat timestamp differs, producing a different token
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Use the refresh token
      const refreshResult = await authService.refresh(originalRefresh);

      expect(refreshResult.accessToken).toBeDefined();
      expect(typeof refreshResult.accessToken).toBe('string');
      expect(refreshResult.refreshToken).toBeDefined();
      expect(typeof refreshResult.refreshToken).toBe('string');

      // New tokens should be different from old ones (different iat)
      expect(refreshResult.refreshToken).not.toBe(originalRefresh);
      expect(refreshResult.accessToken).not.toBe(refreshUser.accessToken);

      // Old refresh token should no longer exist in DB (rotation)
      const oldTokenInDb = await prisma.refreshToken.findUnique({
        where: { token: hashToken(originalRefresh) },
      });
      expect(oldTokenInDb).toBeNull();

      // New refresh token should exist in DB
      const newTokenInDb = await prisma.refreshToken.findUnique({
        where: { token: hashToken(refreshResult.refreshToken) },
      });
      expect(newTokenInDb).not.toBeNull();
    });

    it('refresh: a rotated token works briefly, then is rejected', async () => {
      const rotateUser = await createTestUser('refresh-used');
      authTestOrgIds.push(rotateUser.organization.id);
      const originalRefresh = rotateUser.refreshToken;

      const first = await authService.refresh(originalRefresh);
      expect(first.refreshToken).not.toBe(originalRefresh);

      // A lost or parallel refresh re-presents the old cookie: still accepted
      // inside the grace window, so the user isn't logged out.
      await expect(authService.refresh(originalRefresh)).resolves.toHaveProperty('accessToken');

      // Once the window has passed the old token is dead.
      await prisma.refreshToken.updateMany({
        where: { userId: rotateUser.user.id, expiresAt: { lt: new Date(Date.now() + 120_000) } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(authService.refresh(originalRefresh)).rejects.toThrow('Refresh token expired');
    });

    it('logout: invalidates refresh token', async () => {
      // Create a dedicated user to avoid token hash collisions
      const logoutUser = await createTestUser('logout');
      authTestOrgIds.push(logoutUser.organization.id);

      const tokenHash = hashToken(logoutUser.refreshToken);

      // Verify it exists before logout
      const tokenBefore = await prisma.refreshToken.findUnique({
        where: { token: tokenHash },
      });
      expect(tokenBefore).not.toBeNull();

      // Logout
      await authService.logout(logoutUser.refreshToken);

      // Verify it is gone
      const tokenAfter = await prisma.refreshToken.findUnique({
        where: { token: tokenHash },
      });
      expect(tokenAfter).toBeNull();
    });

    it('getMe: returns user + org info', async () => {
      const result = await authService.getMe(userId);

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe(testEmail);
      expect(result.user.name).toContain('Test User');

      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBe(orgId);
      expect(result.organization.name).toContain('Test Org');
      expect(result.organization.slug).toBeDefined();

      expect(result.role).toBe('OWNER');
    });

    it('getMe: throws for non-existent user', async () => {
      await expect(
        authService.getMe('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('No organization membership found');
    });
  });

  // ─── Agent Service Tests ────────────────────────────────────────────────────

  describe('Agents', () => {
    let agentId: string;

    it('createAgent: creates agent with correct defaults', async () => {
      const agent = await agentService.createAgent(orgId, {
        name: 'test-agent-1',
        displayName: 'Test Agent One',
        description: 'An agent for integration testing',
      });

      agentId = agent.id;

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test-agent-1');
      expect(agent.displayName).toBe('Test Agent One');
      expect(agent.description).toBe('An agent for integration testing');
      expect(agent.status).toBe('IDLE');
      expect(agent.workspace).toBe('');
      expect(agent.heartbeatInterval).toBe(30);
      expect(agent.enabled).toBe(true);
      expect(agent.avatar).toBeNull();
      expect(agent.soulMd).toBeNull();
      // gatewayId may be auto-assigned if a default gateway exists
      expect(agent.gatewayId === null || typeof agent.gatewayId === 'string').toBe(true);
      expect(agent.organizationId).toBe(orgId);
      expect(agent._count).toBeDefined();
      expect(agent._count.activities).toBe(0);
      expect(agent._count.tasks).toBe(0);
    });

    it('createAgent: creates agent with custom values', async () => {
      const agent = await agentService.createAgent(orgId, {
        name: 'test-agent-custom',
        displayName: 'Custom Agent',
        description: 'Custom configuration',
        workspace: '/home/agent/workspace',
        avatar: 'robot',
        heartbeatInterval: 60,
        soulMd: '# Soul\nYou are a helpful assistant.',
        enabled: false,
      });

      expect(agent.name).toBe('test-agent-custom');
      expect(agent.workspace).toBe('/home/agent/workspace');
      expect(agent.avatar).toBe('robot');
      expect(agent.heartbeatInterval).toBe(60);
      expect(agent.soulMd).toBe('# Soul\nYou are a helpful assistant.');
      expect(agent.enabled).toBe(false);
    });

    it('getAllAgents: returns agents for org only', async () => {
      const agents = await agentService.getAllAgents(orgId);

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThanOrEqual(2);

      // All agents belong to our org
      for (const agent of agents) {
        expect(agent.organizationId).toBe(orgId);
      }

      // Agents should be ordered by name ascending
      for (let i = 1; i < agents.length; i++) {
        expect(agents[i].name.localeCompare(agents[i - 1].name)).toBeGreaterThanOrEqual(0);
      }

      // Each agent includes _count
      for (const agent of agents) {
        expect(agent._count).toBeDefined();
        expect(typeof agent._count.activities).toBe('number');
        expect(typeof agent._count.tasks).toBe('number');
      }
    });

    it('getAllAgents: does not return agents from other orgs', async () => {
      // Create a separate org
      const otherUser = await createTestUser('agent-isolation');
      const otherOrgId = otherUser.organization.id;

      try {
        await agentService.createAgent(otherOrgId, {
          name: 'other-org-agent',
          displayName: 'Other Org Agent',
          description: 'Should not appear',
        });

        const agents = await agentService.getAllAgents(orgId);
        const names = agents.map((a) => a.name);
        expect(names).not.toContain('other-org-agent');
      } finally {
        await cleanupTestData(otherOrgId);
      }
    });

    it('getAgentById: returns agent with activities and tasks', async () => {
      const agent = await agentService.getAgentById(agentId, orgId);

      expect(agent).not.toBeNull();
      expect(agent!.id).toBe(agentId);
      expect(agent!.name).toBe('test-agent-1');
      expect(agent!.activities).toBeDefined();
      expect(Array.isArray(agent!.activities)).toBe(true);
      expect(agent!.tasks).toBeDefined();
      expect(Array.isArray(agent!.tasks)).toBe(true);
      expect(agent!._count).toBeDefined();
    });

    it('getAgentById: returns null for non-existent agent', async () => {
      const agent = await agentService.getAgentById(
        '00000000-0000-0000-0000-000000000000',
        orgId
      );
      expect(agent).toBeNull();
    });

    it('getAgentById: returns null for agent in different org', async () => {
      const agent = await agentService.getAgentById(
        agentId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(agent).toBeNull();
    });

    it('updateAgent: partial updates work', async () => {
      const updated = await agentService.updateAgent(agentId, orgId, {
        displayName: 'Updated Agent Name',
        description: 'Updated description',
      });

      expect(updated.id).toBe(agentId);
      expect(updated.displayName).toBe('Updated Agent Name');
      expect(updated.description).toBe('Updated description');
      // Name should not have changed
      expect(updated.name).toBe('test-agent-1');
      expect(updated._count).toBeDefined();
    });

    it('updateAgent: can update workspace and avatar', async () => {
      const updated = await agentService.updateAgent(agentId, orgId, {
        workspace: '/new/workspace',
        avatar: 'new-avatar',
      });

      expect(updated.workspace).toBe('/new/workspace');
      expect(updated.avatar).toBe('new-avatar');
    });

    it('updateAgent: can update enabled flag', async () => {
      const disabled = await agentService.updateAgent(agentId, orgId, {
        enabled: false,
      });
      expect(disabled.enabled).toBe(false);

      const enabled = await agentService.updateAgent(agentId, orgId, {
        enabled: true,
      });
      expect(enabled.enabled).toBe(true);
    });

    it('updateAgentStatus: changes status', async () => {
      const updated = await agentService.updateAgentStatus(agentId, orgId, 'ONLINE');

      expect(updated.id).toBe(agentId);
      expect(updated.status).toBe('ONLINE');
    });

    it('updateAgentStatus: changes status with currentTask', async () => {
      const updated = await agentService.updateAgentStatus(
        agentId,
        orgId,
        'ONLINE',
        'Working on integration tests'
      );

      expect(updated.status).toBe('ONLINE');
      expect(updated.currentTask).toBe('Working on integration tests');
    });

    it('recordHeartbeat: updates lastHeartbeat and sets ONLINE', async () => {
      // First set agent to IDLE
      await agentService.updateAgentStatus(agentId, orgId, 'IDLE');

      const before = new Date();
      const updated = await agentService.recordHeartbeat(agentId, orgId);

      expect(updated.status).toBe('ONLINE');
      expect(updated.lastHeartbeat).toBeDefined();
      expect(updated.lastHeartbeat!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updated.lastHeartbeat!.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('getAgentStats: returns correct counts', async () => {
      // Set up known states: one ONLINE, one IDLE (from createAgent defaults)
      await agentService.updateAgentStatus(agentId, orgId, 'ONLINE');

      const stats = await agentService.getAgentStats(orgId);

      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(typeof stats.online).toBe('number');
      expect(stats.online).toBeGreaterThanOrEqual(1);
      expect(typeof stats.idle).toBe('number');
      expect(typeof stats.offline).toBe('number');
      expect(typeof stats.error).toBe('number');
      expect(typeof stats.recentActivities).toBe('number');
      expect(typeof stats.activeTasks).toBe('number');

      // Sum of status counts should equal total
      expect(stats.online + stats.idle + stats.offline + stats.error).toBe(stats.total);
    });

    it('deleteAgent: removes agent', async () => {
      // Create an agent to delete
      const agent = await agentService.createAgent(orgId, {
        name: 'agent-to-delete',
        displayName: 'Delete Me',
        description: 'Will be deleted',
      });

      // Verify it exists
      const beforeDelete = await agentService.getAgentById(agent.id, orgId);
      expect(beforeDelete).not.toBeNull();

      // Delete it
      await agentService.deleteAgent(agent.id, orgId);

      // Verify it is gone
      const afterDelete = await agentService.getAgentById(agent.id, orgId);
      expect(afterDelete).toBeNull();
    });

    it('deleteAgent: throws for non-existent agent', async () => {
      await expect(
        agentService.deleteAgent('00000000-0000-0000-0000-000000000000', orgId)
      ).rejects.toThrow('Agent not found');
    });
  });

  // ─── Task Service Tests ─────────────────────────────────────────────────────

  describe('Tasks', () => {
    let taskId: string;
    let taskAgentId: string;

    beforeAll(async () => {
      // Create an agent to assign tasks to
      const agent = await agentService.createAgent(orgId, {
        name: 'task-test-agent',
        displayName: 'Task Test Agent',
        description: 'Agent for task tests',
      });
      taskAgentId = agent.id;
    });

    it('createTask: creates with defaults', async () => {
      const task = await taskService.createTask(orgId, {
        title: 'Integration Test Task',
      });

      taskId = task.id;

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Integration Test Task');
      expect(task.status).toBe('BACKLOG');
      expect(task.priority).toBe('MEDIUM');
      expect(task.description).toBeNull();
      expect(task.agentId).toBeNull();
      expect(task.organizationId).toBe(orgId);
      expect(task.agent).toBeNull();
    });

    it('createTask: creates with custom values', async () => {
      const task = await taskService.createTask(orgId, {
        title: 'Custom Task',
        description: 'A detailed description of the task',
        status: 'ASSIGNED',
        priority: 'HIGH',
        agentId: taskAgentId,
      });

      expect(task.title).toBe('Custom Task');
      expect(task.description).toBe('A detailed description of the task');
      expect(task.status).toBe('ASSIGNED');
      expect(task.priority).toBe('HIGH');
      expect(task.agentId).toBe(taskAgentId);
      expect(task.agent).not.toBeNull();
      expect(task.agent!.id).toBe(taskAgentId);
      expect(task.agent!.displayName).toBe('Task Test Agent');
    });

    it('createTask: creates with all priority levels', async () => {
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

      for (const priority of priorities) {
        const task = await taskService.createTask(orgId, {
          title: `${priority} Priority Task`,
          priority,
        });
        expect(task.priority).toBe(priority);
      }
    });

    it('createTask: creates with all status values', async () => {
      const statuses = ['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;

      for (const status of statuses) {
        const task = await taskService.createTask(orgId, {
          title: `${status} Status Task`,
          status,
        });
        expect(task.status).toBe(status);
      }
    });

    it('getAllTasks: returns tasks ordered by priority then updatedAt', async () => {
      const tasks = await taskService.getAllTasks(orgId);

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThanOrEqual(1);

      // All tasks belong to our org
      for (const task of tasks) {
        expect(task.organizationId).toBe(orgId);
      }

      // Tasks include the agent relation
      for (const task of tasks) {
        if (task.agentId) {
          expect(task.agent).not.toBeNull();
          expect(task.agent!.id).toBeDefined();
        }
      }
    });

    it('updateTask: partial update works', async () => {
      const updated = await taskService.updateTask(taskId, orgId, {
        title: 'Updated Task Title',
        description: 'Now with a description',
      });

      expect(updated.id).toBe(taskId);
      expect(updated.title).toBe('Updated Task Title');
      expect(updated.description).toBe('Now with a description');
      // Status should remain unchanged
      expect(updated.status).toBe('BACKLOG');
    });

    it('updateTask: can change status', async () => {
      const updated = await taskService.updateTask(taskId, orgId, {
        status: 'IN_PROGRESS',
      });

      expect(updated.status).toBe('IN_PROGRESS');
    });

    it('updateTask: can assign agent', async () => {
      const updated = await taskService.updateTask(taskId, orgId, {
        agentId: taskAgentId,
      });

      expect(updated.agentId).toBe(taskAgentId);
      expect(updated.agent).not.toBeNull();
      expect(updated.agent!.id).toBe(taskAgentId);
    });

    it('updateTask: can unassign agent', async () => {
      const updated = await taskService.updateTask(taskId, orgId, {
        agentId: null,
      });

      expect(updated.agentId).toBeNull();
      expect(updated.agent).toBeNull();
    });

    it('updateTask: can change priority', async () => {
      const updated = await taskService.updateTask(taskId, orgId, {
        priority: 'CRITICAL',
      });

      expect(updated.priority).toBe('CRITICAL');
    });

    it('deleteTask: removes task', async () => {
      const task = await taskService.createTask(orgId, {
        title: 'Task to Delete',
      });

      // Verify it exists in the list
      const beforeDelete = await taskService.getAllTasks(orgId);
      expect(beforeDelete.some((t) => t.id === task.id)).toBe(true);

      // Delete it
      await taskService.deleteTask(task.id, orgId);

      // Verify it is gone
      const afterDelete = await taskService.getAllTasks(orgId);
      expect(afterDelete.some((t) => t.id === task.id)).toBe(false);
    });
  });

  // ─── Board Service Tests ────────────────────────────────────────────────────

  describe('Boards', () => {
    let boardId: string;
    let boardGroupId: string;
    let boardAgentId: string;

    beforeAll(async () => {
      // Create an agent for board assignment tests
      const agent = await agentService.createAgent(orgId, {
        name: 'board-test-agent',
        displayName: 'Board Test Agent',
        description: 'Agent for board tests',
      });
      boardAgentId = agent.id;
    });

    it('createBoard: creates with slug', async () => {
      const board = await boardService.createBoard(orgId, {
        name: 'My Test Board',
        description: 'A board for testing',
      });

      boardId = board.id;

      expect(board.id).toBeDefined();
      expect(board.name).toBe('My Test Board');
      expect(board.slug).toBe('my-test-board');
      expect(board.description).toBe('A board for testing');
      expect(board.organizationId).toBe(orgId);
      expect(board.boardType).toBe('goal');
      expect(board.maxAgents).toBe(3);
      expect(board.requireApprovalForDone).toBe(true);
      expect(board.gatewayId).toBeNull();
      expect(board.boardGroupId).toBeNull();
      expect(board.objective).toBeNull();
      expect(board.targetDate).toBeNull();
      expect(board._count).toBeDefined();
      expect(board._count.tasks).toBe(0);
      expect(board._count.agents).toBe(0);
      expect(board._count.approvals).toBe(0);
    });

    it('createBoard: creates with custom values', async () => {
      const board = await boardService.createBoard(orgId, {
        name: 'Custom Board',
        description: 'Customized board',
        boardType: 'sprint',
        objective: 'Complete the sprint',
        targetDate: '2026-12-31',
        maxAgents: 5,
        requireApprovalForDone: false,
      });

      expect(board.name).toBe('Custom Board');
      expect(board.slug).toBe('custom-board');
      expect(board.boardType).toBe('sprint');
      expect(board.objective).toBe('Complete the sprint');
      expect(board.targetDate).toBeDefined();
      expect(board.maxAgents).toBe(5);
      expect(board.requireApprovalForDone).toBe(false);
    });

    it('createBoard: generates slug from special characters', async () => {
      const board = await boardService.createBoard(orgId, {
        name: 'Board With  Spaces & Symbols!',
      });

      expect(board.slug).toBe('board-with-spaces-symbols');
    });

    it('getAllBoards: returns boards with counts', async () => {
      const boards = await boardService.getAllBoards(orgId);

      expect(Array.isArray(boards)).toBe(true);
      expect(boards.length).toBeGreaterThanOrEqual(1);

      for (const board of boards) {
        expect(board.organizationId).toBe(orgId);
        expect(board._count).toBeDefined();
        expect(typeof board._count.tasks).toBe('number');
        expect(typeof board._count.agents).toBe('number');
        expect(typeof board._count.approvals).toBe('number');
      }

      // Boards should be ordered by createdAt desc
      for (let i = 1; i < boards.length; i++) {
        expect(boards[i].createdAt.getTime()).toBeLessThanOrEqual(boards[i - 1].createdAt.getTime());
      }
    });

    it('getBoardById: returns board with tasks, agents, approvals', async () => {
      const board = await boardService.getBoardById(boardId, orgId);

      expect(board).not.toBeNull();
      expect(board!.id).toBe(boardId);
      expect(board!.name).toBe('My Test Board');
      expect(board!.tasks).toBeDefined();
      expect(Array.isArray(board!.tasks)).toBe(true);
      expect(board!.agents).toBeDefined();
      expect(Array.isArray(board!.agents)).toBe(true);
      expect(board!.approvals).toBeDefined();
      expect(Array.isArray(board!.approvals)).toBe(true);
      expect(board!._count).toBeDefined();
    });

    it('getBoardById: returns null for non-existent board', async () => {
      const board = await boardService.getBoardById(
        '00000000-0000-0000-0000-000000000000',
        orgId
      );
      expect(board).toBeNull();
    });

    it('getBoardById: returns null for board in different org', async () => {
      const board = await boardService.getBoardById(
        boardId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(board).toBeNull();
    });

    it('updateBoard: partial updates', async () => {
      const updated = await boardService.updateBoard(boardId, orgId, {
        name: 'Updated Board Name',
        description: 'Updated description',
      });

      expect(updated.id).toBe(boardId);
      expect(updated.name).toBe('Updated Board Name');
      expect(updated.slug).toBe('updated-board-name');
      expect(updated.description).toBe('Updated description');
      expect(updated._count).toBeDefined();
    });

    it('updateBoard: can update objective and targetDate', async () => {
      const updated = await boardService.updateBoard(boardId, orgId, {
        objective: 'New objective',
        targetDate: '2027-06-15',
      });

      expect(updated.objective).toBe('New objective');
      expect(updated.targetDate).toBeDefined();
    });

    it('updateBoard: can clear targetDate', async () => {
      const updated = await boardService.updateBoard(boardId, orgId, {
        targetDate: null,
      });

      expect(updated.targetDate).toBeNull();
    });

    it('updateBoard: can update maxAgents and requireApprovalForDone', async () => {
      const updated = await boardService.updateBoard(boardId, orgId, {
        maxAgents: 10,
        requireApprovalForDone: false,
      });

      expect(updated.maxAgents).toBe(10);
      expect(updated.requireApprovalForDone).toBe(false);
    });

    it('deleteBoard: removes board', async () => {
      const board = await boardService.createBoard(orgId, {
        name: 'Board to Delete',
      });

      // Verify it exists
      const exists = await boardService.getBoardById(board.id, orgId);
      expect(exists).not.toBeNull();

      // Delete it
      await boardService.deleteBoard(board.id, orgId);

      // Verify it is gone
      const gone = await boardService.getBoardById(board.id, orgId);
      expect(gone).toBeNull();
    });

    // ─── Board Groups ───────────────────────────────────────────────────

    it('createBoardGroup: creates with slug', async () => {
      const group = await boardService.createBoardGroup(orgId, {
        name: 'Engineering Team',
        description: 'All engineering boards',
      });

      boardGroupId = group.id;

      expect(group.id).toBeDefined();
      expect(group.name).toBe('Engineering Team');
      expect(group.slug).toBe('engineering-team');
      expect(group.description).toBe('All engineering boards');
      expect(group.organizationId).toBe(orgId);
      expect(group._count).toBeDefined();
      expect(group._count.boards).toBe(0);
    });

    it('createBoardGroup: generates slug from name', async () => {
      const group = await boardService.createBoardGroup(orgId, {
        name: 'Marketing & Sales',
      });

      expect(group.slug).toBe('marketing-sales');
    });

    it('getAllBoardGroups: returns groups with board counts', async () => {
      const groups = await boardService.getAllBoardGroups(orgId);

      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThanOrEqual(1);

      for (const group of groups) {
        expect(group.organizationId).toBe(orgId);
        expect(group._count).toBeDefined();
        expect(typeof group._count.boards).toBe('number');
      }
    });

    it('updateBoardGroup: updates name and slug', async () => {
      const updated = await boardService.updateBoardGroup(boardGroupId, orgId, {
        name: 'Backend Engineering',
      });

      expect(updated.id).toBe(boardGroupId);
      expect(updated.name).toBe('Backend Engineering');
      expect(updated.slug).toBe('backend-engineering');
    });

    it('updateBoardGroup: updates description', async () => {
      const updated = await boardService.updateBoardGroup(boardGroupId, orgId, {
        description: 'Updated description for the group',
      });

      expect(updated.description).toBe('Updated description for the group');
      // Name should not have changed
      expect(updated.name).toBe('Backend Engineering');
    });

    it('deleteBoardGroup: removes group', async () => {
      const group = await boardService.createBoardGroup(orgId, {
        name: 'Group to Delete',
      });

      // Delete it
      await boardService.deleteBoardGroup(group.id, orgId);

      // Verify it is gone
      const groups = await boardService.getAllBoardGroups(orgId);
      expect(groups.some((g) => g.id === group.id)).toBe(false);
    });

    // ─── Board-Agent Assignment ─────────────────────────────────────────

    it('addAgentToBoard: links agent to board', async () => {
      const updated = await boardService.addAgentToBoard(boardId, boardAgentId, orgId);

      expect(updated.id).toBe(boardAgentId);
      expect(updated.boardId).toBe(boardId);
      expect(updated.isBoardLead).toBe(false);
    });

    it('addAgentToBoard: can set board lead', async () => {
      const updated = await boardService.addAgentToBoard(boardId, boardAgentId, orgId, true);

      expect(updated.boardId).toBe(boardId);
      expect(updated.isBoardLead).toBe(true);
    });

    it('getBoardById: includes assigned agent after assignment', async () => {
      const board = await boardService.getBoardById(boardId, orgId);

      expect(board).not.toBeNull();
      expect(board!.agents.length).toBeGreaterThanOrEqual(1);
      const assignedAgent = board!.agents.find((a) => a.id === boardAgentId);
      expect(assignedAgent).toBeDefined();
      expect(assignedAgent!.isBoardLead).toBe(true);
    });

    it('removeAgentFromBoard: unlinks agent', async () => {
      const updated = await boardService.removeAgentFromBoard(boardAgentId, orgId);

      expect(updated.id).toBe(boardAgentId);
      expect(updated.boardId).toBeNull();
      expect(updated.isBoardLead).toBe(false);
    });

    it('getBoardById: agent no longer listed after removal', async () => {
      const board = await boardService.getBoardById(boardId, orgId);

      expect(board).not.toBeNull();
      const assignedAgent = board!.agents.find((a) => a.id === boardAgentId);
      expect(assignedAgent).toBeUndefined();
    });

    // ─── Board with BoardGroup relationship ────────────────────────────

    it('createBoard: can assign to a board group', async () => {
      const board = await boardService.createBoard(orgId, {
        name: 'Grouped Board',
        boardGroupId: boardGroupId,
      });

      expect(board.boardGroupId).toBe(boardGroupId);
      expect(board.boardGroup).toBeDefined();
      expect(board.boardGroup!.id).toBe(boardGroupId);
      expect(board.boardGroup!.name).toBe('Backend Engineering');
    });
  });

  // ─── Approval Service Tests ─────────────────────────────────────────────────

  describe('Approvals', () => {
    let approvalBoardId: string;
    let approvalAgentId: string;
    let approvalTaskId: string;
    let pendingApprovalId: string;

    beforeAll(async () => {
      // Set up board, agent, and task for approval tests
      const board = await boardService.createBoard(orgId, {
        name: 'Approval Test Board',
        requireApprovalForDone: true,
      });
      approvalBoardId = board.id;

      const agent = await agentService.createAgent(orgId, {
        name: 'approval-test-agent',
        displayName: 'Approval Test Agent',
        description: 'Agent for approval tests',
      });
      approvalAgentId = agent.id;

      const task = await taskService.createTask(orgId, {
        title: 'Task Needing Approval',
        status: 'IN_PROGRESS',
        agentId: approvalAgentId,
      });
      approvalTaskId = task.id;
    });

    it('createApproval: creates PENDING approval', async () => {
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        taskId: approvalTaskId,
        agentId: approvalAgentId,
        actionType: 'COMPLETE_TASK',
        payload: { reason: 'Task implementation finished' },
        confidence: 0.95,
      });

      pendingApprovalId = approval.id;

      expect(approval.id).toBeDefined();
      expect(approval.status).toBe('PENDING');
      expect(approval.actionType).toBe('COMPLETE_TASK');
      expect(approval.confidence).toBe(0.95);
      expect(approval.resolvedAt).toBeNull();
      expect(approval.boardId).toBe(approvalBoardId);
      expect(approval.taskId).toBe(approvalTaskId);
      expect(approval.agentId).toBe(approvalAgentId);

      // Includes relations
      expect(approval.board).toBeDefined();
      expect(approval.board.id).toBe(approvalBoardId);
      expect(approval.board.name).toBe('Approval Test Board');
      expect(approval.task).toBeDefined();
      expect(approval.task!.id).toBe(approvalTaskId);
      expect(approval.agent).toBeDefined();
      expect(approval.agent!.id).toBe(approvalAgentId);
    });

    it('createApproval: creates without optional fields', async () => {
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        actionType: 'CUSTOM_ACTION',
      });

      expect(approval.status).toBe('PENDING');
      expect(approval.actionType).toBe('CUSTOM_ACTION');
      expect(approval.taskId).toBeNull();
      expect(approval.agentId).toBeNull();
      expect(approval.confidence).toBeNull();
      expect(approval.task).toBeNull();
      expect(approval.agent).toBeNull();
    });

    it('createApproval: stores payload as JSON', async () => {
      const payload = { key: 'value', nested: { a: 1 }, arr: [1, 2, 3] };
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        actionType: 'DATA_ACTION',
        payload,
      });

      expect(approval.payload).toEqual(payload);
    });

    it('getApprovals: returns all approvals for org', async () => {
      const approvals = await approvalService.getApprovals(orgId);

      expect(Array.isArray(approvals)).toBe(true);
      expect(approvals.length).toBeGreaterThanOrEqual(3);

      // Each approval has board, task, agent relations
      for (const approval of approvals) {
        expect(approval.board).toBeDefined();
        expect(approval.board.id).toBeDefined();
      }

      // Ordered by createdAt desc
      for (let i = 1; i < approvals.length; i++) {
        expect(approvals[i].createdAt.getTime()).toBeLessThanOrEqual(
          approvals[i - 1].createdAt.getTime()
        );
      }
    });

    it('getApprovals: filters by boardId', async () => {
      const approvals = await approvalService.getApprovals(orgId, {
        boardId: approvalBoardId,
      });

      expect(approvals.length).toBeGreaterThanOrEqual(1);
      for (const approval of approvals) {
        expect(approval.boardId).toBe(approvalBoardId);
      }
    });

    it('getApprovals: filters by status', async () => {
      const approvals = await approvalService.getApprovals(orgId, {
        status: 'PENDING',
      });

      expect(approvals.length).toBeGreaterThanOrEqual(1);
      for (const approval of approvals) {
        expect(approval.status).toBe('PENDING');
      }
    });

    it('getApprovals: filters by both boardId and status', async () => {
      const approvals = await approvalService.getApprovals(orgId, {
        boardId: approvalBoardId,
        status: 'PENDING',
      });

      expect(approvals.length).toBeGreaterThanOrEqual(1);
      for (const approval of approvals) {
        expect(approval.boardId).toBe(approvalBoardId);
        expect(approval.status).toBe('PENDING');
      }
    });

    it('getApprovals: respects limit parameter', async () => {
      const approvals = await approvalService.getApprovals(orgId, {
        limit: 1,
      });

      expect(approvals.length).toBe(1);
    });

    it('resolveApproval (APPROVED): updates status and moves COMPLETE_TASK to DONE', async () => {
      // Verify the task is currently IN_PROGRESS
      const taskBefore = await prisma.task.findUnique({
        where: { id: approvalTaskId },
      });
      expect(taskBefore!.status).toBe('IN_PROGRESS');

      const resolved = await approvalService.resolveApproval(
        pendingApprovalId,
        orgId,
        'APPROVED'
      );

      expect(resolved.id).toBe(pendingApprovalId);
      expect(resolved.status).toBe('APPROVED');
      expect(resolved.resolvedAt).toBeDefined();
      expect(resolved.resolvedAt).not.toBeNull();
      expect(resolved.resolvedAt!.getTime()).toBeLessThanOrEqual(Date.now());

      // Verify the task was moved to DONE (since actionType was COMPLETE_TASK)
      const taskAfter = await prisma.task.findUnique({
        where: { id: approvalTaskId },
      });
      expect(taskAfter!.status).toBe('DONE');
    });

    it('resolveApproval (REJECTED): updates status only, does not change task', async () => {
      // Create a new task and approval for rejection test
      const task = await taskService.createTask(orgId, {
        title: 'Task for Rejection Test',
        status: 'IN_PROGRESS',
      });
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        taskId: task.id,
        actionType: 'COMPLETE_TASK',
      });

      const resolved = await approvalService.resolveApproval(
        approval.id,
        orgId,
        'REJECTED'
      );

      expect(resolved.status).toBe('REJECTED');
      expect(resolved.resolvedAt).not.toBeNull();

      // Task should remain IN_PROGRESS (not moved to DONE)
      const taskAfter = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(taskAfter!.status).toBe('IN_PROGRESS');
    });

    it('resolveApproval: APPROVED with non-COMPLETE_TASK does not change task', async () => {
      const task = await taskService.createTask(orgId, {
        title: 'Task for Non-Complete Approval',
        status: 'IN_PROGRESS',
      });
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        taskId: task.id,
        actionType: 'REVIEW_CODE',
      });

      const resolved = await approvalService.resolveApproval(
        approval.id,
        orgId,
        'APPROVED'
      );

      expect(resolved.status).toBe('APPROVED');

      // Task should remain IN_PROGRESS because actionType is not COMPLETE_TASK
      const taskAfter = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(taskAfter!.status).toBe('IN_PROGRESS');
    });

    it('resolveApproval: throws for non-existent approval', async () => {
      await expect(
        approvalService.resolveApproval(
          '00000000-0000-0000-0000-000000000000',
          orgId,
          'APPROVED'
        )
      ).rejects.toThrow('Approval not found');
    });

    it('resolveApproval: throws for approval in different org', async () => {
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        actionType: 'TEST_ACTION',
      });

      await expect(
        approvalService.resolveApproval(
          approval.id,
          '00000000-0000-0000-0000-000000000000',
          'APPROVED'
        )
      ).rejects.toThrow('Approval not found');
    });

    it('getApprovalStats: returns correct counts', async () => {
      const stats = await approvalService.getApprovalStats(orgId);

      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.approved).toBe('number');
      expect(typeof stats.rejected).toBe('number');
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBe(stats.pending + stats.approved + stats.rejected);

      // We know we have at least 1 approved and 1 rejected from previous tests
      expect(stats.approved).toBeGreaterThanOrEqual(1);
      expect(stats.rejected).toBeGreaterThanOrEqual(1);
    });

    it('getApprovalById: returns approval with full relations', async () => {
      const approval = await approvalService.createApproval(orgId, {
        boardId: approvalBoardId,
        taskId: approvalTaskId,
        agentId: approvalAgentId,
        actionType: 'GET_BY_ID_TEST',
      });

      const fetched = await approvalService.getApprovalById(approval.id, orgId);

      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(approval.id);
      expect(fetched!.board).toBeDefined();
      expect(fetched!.board.name).toBe('Approval Test Board');
      expect(fetched!.task).toBeDefined();
      expect(fetched!.task!.id).toBe(approvalTaskId);
      expect(fetched!.task!.title).toBe('Task Needing Approval');
      expect(fetched!.agent).toBeDefined();
      expect(fetched!.agent!.id).toBe(approvalAgentId);
    });

    it('getApprovalById: returns null for non-existent approval', async () => {
      const fetched = await approvalService.getApprovalById(
        '00000000-0000-0000-0000-000000000000',
        orgId
      );
      expect(fetched).toBeNull();
    });
  });

  // ─── Agent Token Tests ──────────────────────────────────────────────────────

  describe('Agent Tokens', () => {
    let tokenAgentId: string;

    beforeAll(async () => {
      const agent = await agentService.createAgent(orgId, {
        name: 'token-test-agent',
        displayName: 'Token Test Agent',
        description: 'Agent for token tests',
      });
      tokenAgentId = agent.id;
    });

    it('generateAgentToken: returns nxat_ prefixed token and stores hash', async () => {
      const token = await generateAgentToken(tokenAgentId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.startsWith('nxat_')).toBe(true);
      expect(token.length).toBeGreaterThan(20);

      // Verify the hash is stored in the DB
      const agent = await prisma.agent.findUnique({
        where: { id: tokenAgentId },
        select: { agentTokenHash: true },
      });
      expect(agent).not.toBeNull();
      expect(agent!.agentTokenHash).toBeDefined();
      expect(agent!.agentTokenHash).not.toBeNull();

      // Verify the hash matches
      const expectedHash = hashToken(token);
      expect(agent!.agentTokenHash).toBe(expectedHash);
    });

    it('generateAgentToken: regenerating token replaces the old one', async () => {
      const token1 = await generateAgentToken(tokenAgentId);
      const token2 = await generateAgentToken(tokenAgentId);

      expect(token1).not.toBe(token2);

      // Only the latest hash should be stored
      const agent = await prisma.agent.findUnique({
        where: { id: tokenAgentId },
        select: { agentTokenHash: true },
      });
      const expectedHash = hashToken(token2);
      expect(agent!.agentTokenHash).toBe(expectedHash);

      // Old token hash should not match
      const oldHash = hashToken(token1);
      expect(agent!.agentTokenHash).not.toBe(oldHash);
    });

    it('agent self-auth: valid token authenticates via agentTokenHash lookup', async () => {
      const token = await generateAgentToken(tokenAgentId);
      const tokenHash = hashToken(token);

      // Simulate what the requireAgentToken middleware does
      const agent = await prisma.agent.findUnique({
        where: { agentTokenHash: tokenHash },
        select: { id: true, organizationId: true, name: true, displayName: true, boardId: true },
      });

      expect(agent).not.toBeNull();
      expect(agent!.id).toBe(tokenAgentId);
      expect(agent!.organizationId).toBe(orgId);
      expect(agent!.name).toBe('token-test-agent');
      expect(agent!.displayName).toBe('Token Test Agent');
    });

    it('agent self-auth: invalid token rejects (returns null)', async () => {
      const fakeToken = 'nxat_0000000000000000000000000000000000000000000000000000000000000000';
      const tokenHash = hashToken(fakeToken);

      const agent = await prisma.agent.findUnique({
        where: { agentTokenHash: tokenHash },
        select: { id: true, organizationId: true, name: true, displayName: true, boardId: true },
      });

      expect(agent).toBeNull();
    });

    it('agent self-auth: empty token rejects (returns null)', async () => {
      const tokenHash = hashToken('');

      const agent = await prisma.agent.findUnique({
        where: { agentTokenHash: tokenHash },
        select: { id: true },
      });

      expect(agent).toBeNull();
    });

    it('agent self-auth: old token no longer works after regeneration', async () => {
      const oldToken = await generateAgentToken(tokenAgentId);

      // Regenerate
      await generateAgentToken(tokenAgentId);

      // Old token should no longer authenticate
      const oldHash = hashToken(oldToken);
      const agent = await prisma.agent.findUnique({
        where: { agentTokenHash: oldHash },
        select: { id: true },
      });

      expect(agent).toBeNull();
    });
  });

  // ─── Cross-Service Integration Tests ────────────────────────────────────────

  describe('Cross-Service Integration', () => {
    it('full workflow: create board, assign agent, create task, request and approve completion', async () => {
      // 1. Create a board
      const board = await boardService.createBoard(orgId, {
        name: 'Workflow Test Board',
        requireApprovalForDone: true,
      });

      // 2. Create an agent
      const agent = await agentService.createAgent(orgId, {
        name: 'workflow-agent',
        displayName: 'Workflow Agent',
        description: 'End-to-end workflow test agent',
      });

      // 3. Assign agent to board
      await boardService.addAgentToBoard(board.id, agent.id, orgId, true);

      // 4. Create a task on the board
      const task = await taskService.createTask(orgId, {
        title: 'Workflow Task',
        description: 'A task for the full workflow test',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        agentId: agent.id,
      });

      // 5. Agent requests approval to complete the task
      const approval = await approvalService.createApproval(orgId, {
        boardId: board.id,
        taskId: task.id,
        agentId: agent.id,
        actionType: 'COMPLETE_TASK',
        confidence: 0.98,
      });
      expect(approval.status).toBe('PENDING');

      // 6. Verify board shows the task and agent
      const boardDetail = await boardService.getBoardById(board.id, orgId);
      expect(boardDetail).not.toBeNull();
      expect(boardDetail!.agents.length).toBe(1);
      expect(boardDetail!.agents[0].id).toBe(agent.id);
      expect(boardDetail!.agents[0].isBoardLead).toBe(true);
      expect(boardDetail!.tasks.length).toBe(0); // task is not linked to board via boardId
      expect(boardDetail!.approvals.length).toBeGreaterThanOrEqual(1);

      // 7. Approve the task completion
      const resolved = await approvalService.resolveApproval(approval.id, orgId, 'APPROVED');
      expect(resolved.status).toBe('APPROVED');

      // 8. Verify the task status was moved to DONE
      const finalTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(finalTask!.status).toBe('DONE');

      // 9. Verify approval stats are updated
      const stats = await approvalService.getApprovalStats(orgId);
      expect(stats.approved).toBeGreaterThanOrEqual(1);
    });

    it('agent with token can be looked up, then heartbeat recorded', async () => {
      // Create an agent and generate a token
      const agent = await agentService.createAgent(orgId, {
        name: 'heartbeat-token-agent',
        displayName: 'Heartbeat Token Agent',
        description: 'Tests token auth and heartbeat together',
      });

      const token = await generateAgentToken(agent.id);
      const tokenHash = hashToken(token);

      // Simulate agent self-auth
      const authAgent = await prisma.agent.findUnique({
        where: { agentTokenHash: tokenHash },
        select: { id: true },
      });
      expect(authAgent).not.toBeNull();
      expect(authAgent!.id).toBe(agent.id);

      // Record heartbeat using the authenticated agent's ID
      const heartbeatResult = await agentService.recordHeartbeat(authAgent!.id, orgId);
      expect(heartbeatResult.status).toBe('ONLINE');
      expect(heartbeatResult.lastHeartbeat).toBeDefined();
    });

    it('deleting a board cleans up associated approvals', async () => {
      const board = await boardService.createBoard(orgId, {
        name: 'Board Cascade Delete Test',
      });

      // Create some approvals on this board
      await approvalService.createApproval(orgId, {
        boardId: board.id,
        actionType: 'CASCADE_TEST_1',
      });
      await approvalService.createApproval(orgId, {
        boardId: board.id,
        actionType: 'CASCADE_TEST_2',
      });

      // Verify approvals exist
      const approvalsBefore = await approvalService.getApprovals(orgId, {
        boardId: board.id,
      });
      expect(approvalsBefore.length).toBe(2);

      // Delete the board (should cascade delete approvals)
      await boardService.deleteBoard(board.id, orgId);

      // Verify approvals are gone (board no longer exists so filter won't match)
      const directCount = await prisma.approval.count({
        where: { boardId: board.id },
      });
      expect(directCount).toBe(0);
    });

    it('getAgentById includes tasks assigned to the agent', async () => {
      const agent = await agentService.createAgent(orgId, {
        name: 'agent-with-tasks',
        displayName: 'Agent With Tasks',
        description: 'Verifies task inclusion in agent detail',
      });

      // Create a few tasks assigned to this agent
      await taskService.createTask(orgId, {
        title: 'Agent Task 1',
        agentId: agent.id,
        status: 'ASSIGNED',
      });
      await taskService.createTask(orgId, {
        title: 'Agent Task 2',
        agentId: agent.id,
        status: 'IN_PROGRESS',
      });

      // Fetch agent by ID
      const agentDetail = await agentService.getAgentById(agent.id, orgId);
      expect(agentDetail).not.toBeNull();
      expect(agentDetail!.tasks.length).toBe(2);
      expect(agentDetail!._count.tasks).toBe(2);

      const taskTitles = agentDetail!.tasks.map((t) => t.title);
      expect(taskTitles).toContain('Agent Task 1');
      expect(taskTitles).toContain('Agent Task 2');
    });

    it('agent stats reflect task statuses accurately', async () => {
      // Create a fresh org so we have a clean slate for counting
      const freshUser = await createTestUser('stats-test');
      const freshOrgId = freshUser.organization.id;

      try {
        // Create 3 agents: one ONLINE, one IDLE (default), one ERROR
        const agentOnline = await agentService.createAgent(freshOrgId, {
          name: 'stats-online',
          displayName: 'Stats Online',
          description: 'Online agent',
        });
        await agentService.updateAgentStatus(agentOnline.id, freshOrgId, 'ONLINE');

        await agentService.createAgent(freshOrgId, {
          name: 'stats-idle',
          displayName: 'Stats Idle',
          description: 'Idle agent',
        });
        // Default status is IDLE, leave it

        const agentError = await agentService.createAgent(freshOrgId, {
          name: 'stats-error',
          displayName: 'Stats Error',
          description: 'Error agent',
        });
        await agentService.updateAgentStatus(agentError.id, freshOrgId, 'ERROR');

        // Create some active tasks
        await taskService.createTask(freshOrgId, {
          title: 'Active Task 1',
          status: 'ASSIGNED',
        });
        await taskService.createTask(freshOrgId, {
          title: 'Active Task 2',
          status: 'IN_PROGRESS',
        });
        await taskService.createTask(freshOrgId, {
          title: 'Done Task',
          status: 'DONE',
        });

        const stats = await agentService.getAgentStats(freshOrgId);

        expect(stats.total).toBe(3);
        expect(stats.online).toBe(1);
        expect(stats.idle).toBe(1);
        expect(stats.error).toBe(1);
        expect(stats.offline).toBe(0);
        expect(stats.activeTasks).toBe(2); // ASSIGNED + IN_PROGRESS (not DONE)
      } finally {
        await cleanupTestData(freshOrgId);
      }
    });
  });

  // ─── Cross-Organization Isolation Tests ──────────────────────────────────────

  describe('Cross-Organization Isolation', () => {
    let orgAId: string;
    let orgBId: string;

    // Org A resources
    let agentA: any;
    let taskA: any;
    let boardA: any;
    let approvalA: any;

    // Org B resources
    let agentB: any;
    let taskB: any;
    let boardB: any;

    beforeAll(async () => {
      // Create two completely separate organizations
      const userA = await createTestUser('iso-orgA');
      const userB = await createTestUser('iso-orgB');
      orgAId = userA.organization.id;
      orgBId = userB.organization.id;

      // --- Org A data ---
      agentA = await agentService.createAgent(orgAId, {
        name: 'agent-alpha',
        displayName: 'Agent Alpha',
        description: 'Org A agent',
      });
      taskA = await taskService.createTask(orgAId, {
        title: 'Org A Secret Task',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        agentId: agentA.id,
      });
      boardA = await boardService.createBoard(orgAId, {
        name: 'Org A Board',
        requireApprovalForDone: true,
      });
      await boardService.addAgentToBoard(boardA.id, agentA.id, orgAId);
      approvalA = await approvalService.createApproval(orgAId, {
        boardId: boardA.id,
        taskId: taskA.id,
        agentId: agentA.id,
        actionType: 'COMPLETE_TASK',
        confidence: 0.9,
      });

      // --- Org B data ---
      agentB = await agentService.createAgent(orgBId, {
        name: 'agent-beta',
        displayName: 'Agent Beta',
        description: 'Org B agent',
      });
      taskB = await taskService.createTask(orgBId, {
        title: 'Org B Secret Task',
        status: 'BACKLOG',
      });
      boardB = await boardService.createBoard(orgBId, {
        name: 'Org B Board',
      });
    });

    afterAll(async () => {
      await cleanupTestData(orgAId);
      await cleanupTestData(orgBId);
    });

    // ─── Agent Isolation ───────────────────────────────────────────────

    it('Org B cannot list Org A agents', async () => {
      const agents = await agentService.getAllAgents(orgBId);
      const leaked = agents.find((a) => a.id === agentA.id);
      expect(leaked).toBeUndefined();
    });

    it('Org B cannot get Org A agent by ID', async () => {
      const agent = await agentService.getAgentById(agentA.id, orgBId);
      expect(agent).toBeNull();
    });

    it('Org B cannot update Org A agent status', async () => {
      await expect(
        agentService.updateAgentStatus(agentA.id, orgBId, 'ERROR')
      ).rejects.toThrow();

      // Verify agent A is unchanged
      const agent = await agentService.getAgentById(agentA.id, orgAId);
      expect(agent!.status).not.toBe('ERROR');
    });

    it('Org B cannot heartbeat Org A agent', async () => {
      await expect(
        agentService.recordHeartbeat(agentA.id, orgBId)
      ).rejects.toThrow();
    });

    it('Org B cannot update Org A agent', async () => {
      await expect(
        agentService.updateAgent(agentA.id, orgBId, { displayName: 'Hacked' })
      ).rejects.toThrow();

      // Verify name unchanged
      const agent = await agentService.getAgentById(agentA.id, orgAId);
      expect(agent!.displayName).toBe('Agent Alpha');
    });

    it('Org B cannot delete Org A agent', async () => {
      await expect(
        agentService.deleteAgent(agentA.id, orgBId)
      ).rejects.toThrow();

      // Verify still exists
      const agent = await agentService.getAgentById(agentA.id, orgAId);
      expect(agent).not.toBeNull();
    });

    // ─── Task Isolation ────────────────────────────────────────────────

    it('Org B cannot list Org A tasks', async () => {
      const tasks = await taskService.getAllTasks(orgBId);
      const leaked = tasks.find((t) => t.id === taskA.id);
      expect(leaked).toBeUndefined();
    });

    it('Org B cannot update Org A task', async () => {
      await expect(
        taskService.updateTask(taskA.id, orgBId, { title: 'Hacked Task' })
      ).rejects.toThrow();
    });

    it('Org B cannot delete Org A task', async () => {
      await expect(
        taskService.deleteTask(taskA.id, orgBId)
      ).rejects.toThrow();
    });

    // ─── Board Isolation ───────────────────────────────────────────────

    it('Org B cannot list Org A boards', async () => {
      const boards = await boardService.getAllBoards(orgBId);
      const leaked = boards.find((b) => b.id === boardA.id);
      expect(leaked).toBeUndefined();
    });

    it('Org B cannot get Org A board by ID', async () => {
      const board = await boardService.getBoardById(boardA.id, orgBId);
      expect(board).toBeNull();
    });

    it('Org B cannot update Org A board', async () => {
      await expect(
        boardService.updateBoard(boardA.id, orgBId, { name: 'Hacked Board' })
      ).rejects.toThrow();
    });

    it('Org B cannot delete Org A board', async () => {
      await expect(
        boardService.deleteBoard(boardA.id, orgBId)
      ).rejects.toThrow();
    });

    // ─── Board-Agent Cross-Org Assignment ──────────────────────────────

    it('Org B cannot add its agent to Org A board', async () => {
      await expect(
        boardService.addAgentToBoard(boardA.id, agentB.id, orgBId)
      ).rejects.toThrow('Board not found');
    });

    it('Org A cannot add Org B agent to its own board', async () => {
      await expect(
        boardService.addAgentToBoard(boardA.id, agentB.id, orgAId)
      ).rejects.toThrow('Agent not found');
    });

    it('Org B cannot remove Org A agent from board', async () => {
      await expect(
        boardService.removeAgentFromBoard(agentA.id, orgBId)
      ).rejects.toThrow();
    });

    // ─── Approval Isolation ────────────────────────────────────────────

    it('Org B cannot list Org A approvals', async () => {
      const approvals = await approvalService.getApprovals(orgBId);
      const leaked = approvals.find((a) => a.id === approvalA.id);
      expect(leaked).toBeUndefined();
    });

    it('Org B cannot get Org A approval by ID', async () => {
      const approval = await approvalService.getApprovalById(approvalA.id, orgBId);
      expect(approval).toBeNull();
    });

    it('Org B cannot resolve Org A approval', async () => {
      await expect(
        approvalService.resolveApproval(approvalA.id, orgBId, 'APPROVED')
      ).rejects.toThrow('Approval not found');

      // Verify approval A still PENDING
      const approval = await approvalService.getApprovalById(approvalA.id, orgAId);
      expect(approval!.status).toBe('PENDING');
    });

    it('Org B cannot create approval on Org A board', async () => {
      await expect(
        approvalService.createApproval(orgBId, {
          boardId: boardA.id,
          actionType: 'MALICIOUS_ACTION',
        })
      ).rejects.toThrow('Board not found');
    });

    it('Org B approval stats do not include Org A data', async () => {
      const statsA = await approvalService.getApprovalStats(orgAId);
      const statsB = await approvalService.getApprovalStats(orgBId);

      expect(statsA.pending).toBeGreaterThanOrEqual(1); // approvalA
      expect(statsB.total).toBe(0); // Org B has no approvals
    });

    // ─── Stats Isolation ───────────────────────────────────────────────

    it('Agent stats are org-scoped', async () => {
      const statsA = await agentService.getAgentStats(orgAId);
      const statsB = await agentService.getAgentStats(orgBId);

      // Each org should only see its own agents
      expect(statsA.total).toBe(1); // agent-alpha
      expect(statsB.total).toBe(1); // agent-beta
    });

    // ─── Verify Org A can still access its own data ────────────────────

    it('Org A can still access all its own resources', async () => {
      const agents = await agentService.getAllAgents(orgAId);
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe(agentA.id);

      const board = await boardService.getBoardById(boardA.id, orgAId);
      expect(board).not.toBeNull();
      expect(board!.name).toBe('Org A Board');

      const approval = await approvalService.getApprovalById(approvalA.id, orgAId);
      expect(approval).not.toBeNull();
      expect(approval!.status).toBe('PENDING');
    });
  });
});
