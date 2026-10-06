import 'dotenv/config';
import { signAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

async function testProcessPlanning() {
  console.log('=== TESTING PROCESS PLANNING & CREATION ===\n');

  const adminUser = await prisma.user.findFirst({
    include: { memberships: { include: { organization: true } } },
  });
  if (!adminUser || adminUser.memberships.length === 0) throw new Error('No admin user');

  const token = signAccessToken({ userId: adminUser.id, email: adminUser.email });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const baseUrl = 'http://localhost:4000/api';

  // 1. Plan a process
  console.log('[PROCESS-PLAN] Requesting autonomous plan for goal...');
  const planPrompt = 'Build an automated health check API endpoint with metrics and alerting';
  const planRes = await fetch(`${baseUrl}/processes/plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: planPrompt, agentCount: 3 }),
  });

  if (!planRes.ok) {
    console.error('❌ /processes/plan failed:', planRes.status, await planRes.text());
    return;
  }

  const plan = await planRes.json();
  console.log('✅ [PROCESS-PLAN] Received plan with roster:');
  console.log('Title:', plan.title || plan.name);
  console.log('Roster count:', plan.roster?.length || plan.agents?.length || 0);
  if (plan.roster) {
    plan.roster.forEach((r: any, idx: number) => {
      console.log(`  ${idx + 1}. [${r.role || r.name}] ${r.displayName || r.name}: ${r.task || r.description || ''}`);
    });
  }

  // 2. Create the process
  console.log('\n[PROCESS-CREATE] Saving and instantiating process...');
  const createRes = await fetch(`${baseUrl}/processes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: planPrompt,
      name: plan.title || 'Automated Health Check Project',
      plan,
    }),
  });

  if (!createRes.ok) {
    console.error('❌ POST /processes failed:', createRes.status, await createRes.text());
    return;
  }

  const proc = await createRes.json();
  console.log('✅ [PROCESS-CREATE] Created process ID:', proc.id, '| Status:', proc.status);

  // 3. Check process listing
  const listRes = await fetch(`${baseUrl}/processes`, { headers });
  const list = await listRes.json();
  console.log('✅ [PROCESS-LIST] Total processes in org:', list.length);

  // 4. Test Process stats
  const statsRes = await fetch(`${baseUrl}/processes/stats`, { headers });
  const stats = await statsRes.json();
  console.log('✅ [PROCESS-STATS] Process stats:', stats);
}

testProcessPlanning().catch(console.error).finally(() => process.exit(0));
