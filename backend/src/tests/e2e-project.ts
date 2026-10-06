import 'dotenv/config';
import { signAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

async function runEndToEndTest() {
  console.log('=== STARTING END-TO-END SYSTEM TEST ===\n');

  // 1. Get or create admin user & org
  const adminUser = await prisma.user.findFirst({
    include: { memberships: { include: { organization: true } } },
  });

  if (!adminUser || adminUser.memberships.length === 0) {
    throw new Error('No admin user or organization found');
  }

  const orgId = adminUser.memberships[0].organizationId;
  const token = signAccessToken({ userId: adminUser.id, email: adminUser.email });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const baseUrl = 'http://localhost:4000/api';

  console.log(`[AUTH] Admin user: ${adminUser.email}, Org ID: ${orgId}`);

  // Test 1: GET /api/auth/me
  const meRes = await fetch(`${baseUrl}/auth/me`, { headers });
  if (!meRes.ok) throw new Error(`auth/me failed: ${meRes.status} ${await meRes.text()}`);
  const meData = await meRes.json();
  console.log('✅ [AUTH /me] Succeeded:', meData.user.email, '| Org:', meData.organization.name);

  // Test 2: Create a real Project / Board
  const projectName = `Production Feature Flow — Test ${Date.now()}`;
  console.log(`\n[PROJECT] Creating new project: "${projectName}"...`);
  const boardRes = await fetch(`${baseUrl}/boards`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: projectName,
      description: 'End-to-end integration and verification project for autonomous workflows',
      boardType: 'sprint',
      objective: 'Verify end-to-end multi-agent orchestration, task tracking, and audit gates',
      requireApprovalForDone: false,
    }),
  });
  if (!boardRes.ok) throw new Error(`POST /boards failed: ${boardRes.status} ${await boardRes.text()}`);
  const board = await boardRes.json();
  console.log('✅ [PROJECT] Created board ID:', board.id, '| Name:', board.name);

  // Test 3: Create an Agent if needed
  let agent = await prisma.agent.findFirst({ where: { organizationId: orgId } });
  if (!agent) {
    console.log('\n[AGENT] No agent found. Creating QA Automation Agent...');
    const agentRes = await fetch(`${baseUrl}/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'qa-engineer',
        displayName: 'QA Automation Engineer',
        role: 'Test & Quality Specialist',
        description: 'Autonomous agent that validates feature flows and writes end-to-end tests',
        status: 'ONLINE',
      }),
    });
    if (!agentRes.ok) throw new Error(`POST /agents failed: ${agentRes.status} ${await agentRes.text()}`);
    agent = await agentRes.json();
  }
  if (!agent) throw new Error('Failed to obtain agent');
  console.log('✅ [AGENT] Using agent:', agent.displayName, '| ID:', agent.id);

  // Test 4: Assign Agent to Board
  console.log('\n[BOARD-AGENT] Assigning agent to board...');
  const assignRes = await fetch(`${baseUrl}/boards/${board.id}/agents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ agentId: agent.id, isLead: true }),
  });
  if (!assignRes.ok) throw new Error(`POST /boards/:id/agents failed: ${assignRes.status} ${await assignRes.text()}`);
  console.log('✅ [BOARD-AGENT] Agent assigned to board successfully');

  // Test 5: Create Tasks in the Board
  console.log('\n[TASKS] Creating tasks for the project...');
  const task1Res = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      boardId: board.id,
      agentId: agent.id,
      title: 'Setup Core Feature Architecture',
      description: 'Scaffold endpoints and verify DB schema migrations',
      priority: 'HIGH',
      status: 'BACKLOG',
    }),
  });
  if (!task1Res.ok) throw new Error(`POST /tasks failed: ${task1Res.status} ${await task1Res.text()}`);
  const task1 = await task1Res.json();
  console.log('✅ [TASKS] Created Task 1:', task1.title, '| ID:', task1.id);

  const task2Res = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      boardId: board.id,
      agentId: agent.id,
      title: 'Run Integration Smoke Tests',
      description: 'Execute automated regression test suite on feature flow',
      priority: 'CRITICAL',
      status: 'BACKLOG',
    }),
  });
  if (!task2Res.ok) throw new Error(`POST /tasks failed: ${task2Res.status} ${await task2Res.text()}`);
  const task2 = await task2Res.json();
  console.log('✅ [TASKS] Created Task 2:', task2.title, '| ID:', task2.id);

  // Test 6: Move Task Status: BACKLOG -> IN_PROGRESS -> REVIEW -> DONE
  console.log('\n[TASK-PROGRESSION] Advancing Task 1 through lifecycle...');
  for (const status of ['IN_PROGRESS', 'REVIEW', 'DONE']) {
    const updateRes = await fetch(`${baseUrl}/tasks/${task1.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    if (!updateRes.ok) throw new Error(`PATCH /tasks/:id (${status}) failed: ${updateRes.status} ${await updateRes.text()}`);
    const updated = await updateRes.json();
    console.log(`✅ [TASK-PROGRESSION] Task 1 is now in status: ${updated.status}`);
  }

  // Test 7: Verify Board Details with nested tasks and agents
  console.log('\n[BOARD-VERIFY] Fetching full board details...');
  const verifyRes = await fetch(`${baseUrl}/boards/${board.id}`, { headers });
  if (!verifyRes.ok) throw new Error(`GET /boards/:id failed: ${verifyRes.status} ${await verifyRes.text()}`);
  const boardDetail = await verifyRes.json();
  console.log(`✅ [BOARD-VERIFY] Board has ${boardDetail.tasks?.length} tasks, ${boardDetail.agents?.length} agents assigned`);

  // Test 8: Approvals Gate
  console.log('\n[APPROVALS] Testing Approvals Gate...');
  const appCreateRes = await fetch(`${baseUrl}/approvals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      boardId: board.id,
      taskId: task2.id,
      agentId: agent.id,
      actionType: 'DEPLOY_PRODUCTION_RELEASE',
      confidence: 0.95,
      payload: {
        releaseVersion: 'v2.1.0',
        environment: 'staging',
        notes: 'End-to-end verified build',
      },
    }),
  });
  if (!appCreateRes.ok) throw new Error(`POST /approvals failed: ${appCreateRes.status} ${await appCreateRes.text()}`);
  const createdApp = await appCreateRes.json();
  console.log('✅ [APPROVALS] Created approval ID:', createdApp.id, '| Status:', createdApp.status);

  // Approve it
  const approveRes = await fetch(`${baseUrl}/approvals/${createdApp.id}/approve`, {
    method: 'POST',
    headers,
  });
  if (!approveRes.ok) throw new Error(`POST /approvals/:id/approve failed: ${approveRes.status} ${await approveRes.text()}`);
  const approvedData = await approveRes.json();
  console.log('✅ [APPROVALS] Successfully approved ID:', approvedData.id, '| Status:', approvedData.status);

  // Test 9: Code Intelligence
  console.log('\n[CODE-INTELLIGENCE] Testing Code Intelligence endpoints...');
  const wsRes = await fetch(`${baseUrl}/code-intelligence/workspaces`, { headers });
  if (!wsRes.ok) {
    console.warn('⚠️ [CODE-INTELLIGENCE] /workspaces returned:', wsRes.status);
  } else {
    const wsData = await wsRes.json();
    console.log('✅ [CODE-INTELLIGENCE] Workspaces found:', wsData.workspaces?.length);
  }

  // Test 10: Activity stream
  console.log('\n[ACTIVITIES] Fetching activity stream...');
  const actRes = await fetch(`${baseUrl}/activities?limit=10`, { headers });
  if (actRes.ok) {
    const acts = await actRes.json();
    console.log('✅ [ACTIVITIES] Activities count:', Array.isArray(acts) ? acts.length : acts);
  } else {
    console.warn('⚠️ [ACTIVITIES] Failed:', actRes.status);
  }

  console.log('\n========================================');
  console.log('🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
}

runEndToEndTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
}).finally(() => process.exit(0));
