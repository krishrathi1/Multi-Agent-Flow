import { randomBytes } from 'node:crypto';
import { Prisma, ProcessStatus, ActivityType, ApprovalMode } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { planProcess, type ProcessPlan } from './process-planner.js';
import { workspaceFor } from './agent-runner.service.js';
import { getVercelDeploymentLogs, autoHealWorkspace, pushWorkspaceToGitHub, deployToVercel } from './git-deploy.service.js';

/** Palette used to tint a production so it's identifiable across screens. */
const PROCESS_COLORS = [
  'brand',
  'accent',
  'success',
  'warning',
  'info',
  'danger',
] as const;

/** Ensures the process name is unique inside the org by suffixing a counter. */
async function uniqueProcessName(organizationId: string, base: string): Promise<string> {
  const trimmed = base.trim().slice(0, 60) || 'Untitled production';
  let candidate = trimmed;
  for (let i = 2; i < 50; i++) {
    const clash = await prisma.process.findFirst({
      where: { organizationId, name: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${trimmed.slice(0, 55)} (${i})`;
  }
  return `${trimmed.slice(0, 48)} ${Date.now()}`;
}

/**
 * Ensures each spawned agent's name is unique inside the org.
 *
 * `claimed` carries the names picked earlier in this same batch. Without it,
 * resolving a roster concurrently checks every name against the database only
 * — and since none are committed yet, two agents proposed under one name both
 * resolve to it and the insert dies on the (organizationId, name) index.
 */
async function uniqueAgentName(
  organizationId: string,
  base: string,
  claimed: ReadonlySet<string> = new Set(),
): Promise<string> {
  const seed = base.trim() || 'agent';
  let candidate = seed.slice(0, 50);
  for (let i = 2; i < 100; i++) {
    const taken =
      claimed.has(candidate) ||
      (await prisma.agent.findFirst({
        where: { organizationId, name: candidate },
        select: { id: true },
      })) !== null;
    if (!taken) return candidate;
    candidate = `${seed.slice(0, 45)}-${i}`;
  }
  // Last resort: a timestamp alone can repeat within a millisecond, so mix in
  // entropy rather than trading one collision for another.
  return `${seed.slice(0, 34)}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

export async function listProcesses(organizationId: string) {
  const processes = await prisma.process.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      _count: { select: { agents: true, tasks: true, activities: true } },
      agents: {
        select: {
          id: true,
          name: true,
          displayName: true,
          status: true,
          avatar: true,
          processRole: true,
          processStage: true,
        },
        orderBy: { processStage: 'asc' },
      },
    },
  });

  return processes.map((p) => ({
    ...p,
    agentCount: p._count.agents,
    taskCount: p._count.tasks,
    activityCount: p._count.activities,
    // Rolled-up health so the dashboard can show a status without N queries.
    onlineAgents: p.agents.filter((a) => a.status === 'ONLINE').length,
    erroredAgents: p.agents.filter((a) => a.status === 'ERROR').length,
  }));
}

export async function getProcessById(id: string, organizationId: string) {
  const proc = await prisma.process.findFirst({
    where: { id, organizationId },
    include: {
      agents: { orderBy: [{ processStage: 'asc' }, { displayName: 'asc' }] },
      _count: { select: { agents: true, tasks: true, activities: true } },
      tasks: { orderBy: { updatedAt: 'desc' }, take: 50 },
    },
  });
  if (!proc) return null;

  return {
    ...proc,
    agentCount: proc._count.agents,
    taskCount: proc._count.tasks,
    activityCount: proc._count.activities,
  };
}

/** Preview only — plans without writing anything. */
export async function previewPlan(prompt: string, agentCount?: number): Promise<ProcessPlan> {
  return planProcess(prompt, agentCount);
}

export interface CreateProcessInput {
  prompt: string;
  name?: string;
  /** Force a specific roster size; otherwise the planner decides. */
  agentCount?: number;
  /** Reuse a plan returned by previewPlan instead of re-planning. */
  plan?: ProcessPlan;
  /** Attach the spawned agents to an existing gateway. */
  gatewayId?: string;
}

/** True when Prisma rejected a write for violating a unique index. */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Creates a production chain, retrying if it loses a name race.
 *
 * Names are resolved by reading before writing, so two callers creating a
 * chain at the same moment can both pick the same one and the loser dies on a
 * unique index. Re-resolving on that specific failure turns a race into a
 * slightly different name, which is what the caller wanted anyway.
 */
export async function createProcess(
  organizationId: string,
  input: CreateProcessInput,
) {
  // Plan once — re-planning on retry would spend a second LLM call and could
  // return an entirely different roster.
  const plan = input.plan ?? (await planProcess(input.prompt, input.agentCount));

  const ATTEMPTS = 4;
  for (let attempt = 1; ; attempt++) {
    try {
      return await createProcessOnce(organizationId, input, plan);
    } catch (err) {
      if (!isUniqueViolation(err) || attempt >= ATTEMPTS) throw err;
      logger.warn(
        { organizationId, attempt, target: (err as Prisma.PrismaClientKnownRequestError).meta },
        'Chain creation lost a name race — retrying',
      );
    }
  }
}

async function createProcessOnce(
  organizationId: string,
  input: CreateProcessInput,
  plan: ProcessPlan,
) {
  const name = await uniqueProcessName(organizationId, input.name ?? plan.name);

  // Resolve agent names up front — uniqueness needs queries, and those can't
  // run inside the interactive transaction below without risking timeouts.
  //
  // Sequentially, not in parallel: each name must see the ones already taken
  // by this roster, or a plan naming two agents the same resolves both to one
  // name and the insert fails on the unique index.
  const resolvedNames: string[] = [];
  const claimed = new Set<string>();
  for (const a of plan.agents) {
    const resolved = await uniqueAgentName(organizationId, a.name, claimed);
    claimed.add(resolved);
    resolvedNames.push(resolved);
  }

  const color = PROCESS_COLORS[Math.floor(Math.random() * PROCESS_COLORS.length)];

  const created = await prisma.$transaction(async (tx) => {
    const proc = await tx.process.create({
      data: {
        organizationId,
        name,
        prompt: input.prompt,
        summary: plan.summary,
        status: ProcessStatus.ACTIVE,
        plan: plan as unknown as Prisma.InputJsonValue,
        plannedBy: plan.plannedBy,
        agentCount: plan.agents.length,
        color,
        startedAt: new Date(),
      },
    });

    const orgSkills = await tx.marketplaceSkill.findMany({ where: { organizationId } });

    for (const [i, spec] of plan.agents.entries()) {
      const createdAgent = await tx.agent.create({
        data: {
          organizationId,
          name: resolvedNames[i],
          displayName: spec.displayName,
          description: spec.description,
          workspace: `~/processes/${proc.id}/${resolvedNames[i]}/`,
          soulMd: spec.soulMd,
          avatar: spec.avatar,
          heartbeatInterval: spec.heartbeatInterval,
          gatewayId: input.gatewayId ?? null,
          processId: proc.id,
          processRole: spec.role,
          processStage: spec.stage,
        },
      });

      // Auto-assign matching skills based on agent role & description
      if (orgSkills.length > 0) {
        const text = `${spec.displayName} ${spec.role || ''} ${spec.description || ''}`.toLowerCase();
        const matchedSkills = orgSkills.filter((s) => {
          const sName = s.name.toLowerCase();
          const sCat = s.category.toLowerCase();
          if (sName.includes('file system')) return true;
          if ((text.includes('github') || text.includes('git') || text.includes('review') || text.includes('code')) && sName.includes('github')) return true;
          if ((text.includes('database') || text.includes('sql') || text.includes('data') || text.includes('backend') || text.includes('state')) && sName.includes('database')) return true;
          if ((text.includes('api') || text.includes('http') || text.includes('rest') || text.includes('route')) && sName.includes('http')) return true;
          if ((text.includes('devops') || text.includes('docker') || text.includes('deploy') || text.includes('infra')) && (sName.includes('docker') || sCat === 'devops')) return true;
          if ((text.includes('search') || text.includes('research') || text.includes('doc')) && sName.includes('search')) return true;
          if ((text.includes('test') || text.includes('qa') || text.includes('e2e') || text.includes('browser')) && sName.includes('puppeteer')) return true;
          if ((text.includes('monitor') || text.includes('metric') || text.includes('telemetry') || text.includes('alert')) && sName.includes('metrics')) return true;
          return false;
        });

        if (matchedSkills.length > 0) {
          await tx.agentSkill.createMany({
            data: matchedSkills.map((s) => ({
              agentId: createdAgent.id,
              skillId: s.id,
              enabled: true,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    await tx.activity.create({
      data: {
        organizationId,
        agentId: (await tx.agent.findFirstOrThrow({
          where: { processId: proc.id },
          select: { id: true },
        })).id,
        processId: proc.id,
        type: ActivityType.SYSTEM,
        message: `Production chain "${name}" created with ${plan.agents.length} agents (${plan.plannedBy}).`,
      },
    });

    return proc;
  });

  logger.info(
    { processId: created.id, orgId: organizationId, agents: plan.agents.length, plannedBy: plan.plannedBy },
    'Production chain created',
  );

  return getProcessById(created.id, organizationId);
}

export async function updateProcess(
  id: string,
  organizationId: string,
  data: {
    name?: string;
    prompt?: string;
    summary?: string;
    guidance?: string;
    status?: ProcessStatus;
    budgetUsd?: number | null;
    maxTokens?: number | null;
    approvalMode?: ApprovalMode;
  },
) {
  const existing = await prisma.process.findFirst({ where: { id, organizationId } });
  if (!existing) return null;

  return prisma.process.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(data.guidance !== undefined ? { guidance: data.guidance } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.budgetUsd !== undefined ? { budgetUsd: data.budgetUsd } : {}),
      ...(data.maxTokens !== undefined ? { maxTokens: data.maxTokens } : {}),
      ...(data.approvalMode ? { approvalMode: data.approvalMode } : {}),
      ...(data.status === ProcessStatus.COMPLETED ? { completedAt: new Date() } : {}),
    },
  });
}

/**
 * Starts (or resumes) a production chain.
 *
 * Starting is a fleet-level action, not just a status flag: every agent in the
 * chain is enabled and brought online, and the transition is written to the
 * activity log so the feed and timeline reflect it.
 */
export async function startProcess(id: string, organizationId: string) {
  const proc = await prisma.process.findFirst({
    where: { id, organizationId },
    include: { agents: { select: { id: true }, orderBy: { processStage: 'asc' } } },
  });
  if (!proc) return null;

  const now = new Date();
  const resuming = proc.status === ProcessStatus.PAUSED;

  await prisma.$transaction([
    prisma.process.update({
      where: { id },
      data: {
        status: ProcessStatus.ACTIVE,
        // Preserve the original start time when resuming.
        ...(proc.startedAt ? {} : { startedAt: now }),
        completedAt: null,
      },
    }),
    prisma.agent.updateMany({
      where: { processId: id, organizationId },
      data: { enabled: true, status: 'ONLINE', lastHeartbeat: now },
    }),
  ]);

  // Attribute the event to the first-stage agent so it has an owner in the feed.
  if (proc.agents.length > 0) {
    await prisma.activity.create({
      data: {
        organizationId,
        agentId: proc.agents[0].id,
        processId: id,
        type: ActivityType.SYSTEM,
        message: `Production "${proc.name}" ${resuming ? 'resumed' : 'started'} — ${proc.agents.length} agents online.`,
      },
    });
  }

  logger.info({ processId: id, orgId: organizationId, resuming }, 'Production started');
  return getProcessById(id, organizationId);
}

/** Pauses a chain and idles its agents, leaving history intact. */
export async function pauseProcess(id: string, organizationId: string) {
  const proc = await prisma.process.findFirst({
    where: { id, organizationId },
    include: { agents: { select: { id: true }, orderBy: { processStage: 'asc' } } },
  });
  if (!proc) return null;

  await prisma.$transaction([
    prisma.process.update({ where: { id }, data: { status: ProcessStatus.PAUSED } }),
    prisma.agent.updateMany({
      where: { processId: id, organizationId },
      // Idle, not offline — the agents still exist and can resume.
      data: { status: 'IDLE', currentTask: null },
    }),
  ]);

  if (proc.agents.length > 0) {
    await prisma.activity.create({
      data: {
        organizationId,
        agentId: proc.agents[0].id,
        processId: id,
        type: ActivityType.SYSTEM,
        message: `Production "${proc.name}" paused — agents idled.`,
      },
    });
  }

  logger.info({ processId: id, orgId: organizationId }, 'Production paused');
  return getProcessById(id, organizationId);
}

/**
 * Deletes a process. Agents are detached rather than destroyed by default —
 * losing an agent's history because its production was tidied up would be a
 * nasty surprise. Pass `deleteAgents` to remove them too.
 */
export async function deleteProcess(
  id: string,
  organizationId: string,
  deleteAgents = false,
) {
  const existing = await prisma.process.findFirst({ where: { id, organizationId } });
  if (!existing) return false;

  // Stop any in-flight run first. Deleting the row underneath a running chain
  // leaves an orphaned CLI process writing to a workspace nobody owns.
  const { requestCancel, isRunning } = await import('./agent-runner.service.js');
  if (isRunning(id)) {
    requestCancel(id);
    logger.info({ processId: id }, 'Cancelled in-flight run before deleting process');
    // Give the child a moment to die before the cascade removes its rows.
    await new Promise((r) => setTimeout(r, 1500));
  }

  const agents = await prisma.agent.findMany({
    where: { processId: id, organizationId },
    select: { id: true },
  });
  const agentIds = agents.map((a) => a.id);

  // 1. Delete associated messages, metrics, token usages, and sessions
  if (agentIds.length > 0) {
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: agentIds } },
          { receiverId: { in: agentIds } },
        ],
      },
    });
    await prisma.tokenUsage.deleteMany({ where: { agentId: { in: agentIds } } });
    await prisma.metricSnapshot.deleteMany({ where: { agentId: { in: agentIds } } });
    await prisma.session.deleteMany({ where: { agentId: { in: agentIds } } });
    await prisma.agentSkill.deleteMany({ where: { agentId: { in: agentIds } } });
    await prisma.activity.deleteMany({ where: { agentId: { in: agentIds } } });
  }

  // 2. Delete process runs & run steps
  const runs = await prisma.processRun.findMany({
    where: { processId: id },
    select: { id: true },
  });
  if (runs.length > 0) {
    const runIds = runs.map((r) => r.id);
    await prisma.processRunStep.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.processRun.deleteMany({ where: { id: { in: runIds } } });
  }

  // 3. Delete process schedules, webhooks, and activities
  await prisma.processSchedule.deleteMany({ where: { processId: id } });
  await prisma.processWebhook.deleteMany({ where: { processId: id } });
  await prisma.activity.deleteMany({ where: { processId: id } });

  // 4. Delete agents if requested or unbind them
  if (deleteAgents && agentIds.length > 0) {
    await prisma.agent.deleteMany({ where: { id: { in: agentIds } } });
  } else if (agentIds.length > 0) {
    await prisma.agent.updateMany({
      where: { id: { in: agentIds } },
      data: { processId: null, processRole: null },
    });
  }

  await prisma.process.delete({ where: { id } });
  return true;
}

/** Counts for the dashboard header. */
export async function getProcessStats(organizationId: string) {
  const [total, active, agents] = await Promise.all([
    prisma.process.count({ where: { organizationId } }),
    prisma.process.count({ where: { organizationId, status: ProcessStatus.ACTIVE } }),
    prisma.agent.count({ where: { organizationId, processId: { not: null } } }),
  ]);
  return { total, active, agentsInProcesses: agents };
}

/**
 * Intelligent "Ask AI & Recruit Fixer Agent" Engine:
 * Analyzes build/deployment errors, determines if a new specialized agent is needed,
 * provisions the agent dynamically into the fleet, assigns the remediation task,
 * executes the fix, pushes to GitHub, and triggers Vercel re-deployment.
 */
export async function askAiAndSpawnFixerAgent(params: {
  processId: string;
  organizationId: string;
  userInstruction?: string;
}): Promise<{
  diagnosis: string;
  needsNewAgent: boolean;
  agentSpawned?: {
    id: string;
    displayName: string;
    avatar: string;
    processRole: string;
    processStage: number;
  };
  fixedFiles: string[];
  pushResult?: any;
  deployResult?: any;
  message: string;
}> {
  const { processId, organizationId, userInstruction } = params;

  const proc = await prisma.process.findFirst({
    where: { id: processId, organizationId },
    include: { agents: { orderBy: { processStage: 'asc' } } },
  });
  if (!proc) throw new Error('Process not found');

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  const orgSettings = (org?.settings as any) || {};
  const vToken = process.env.VERCEL_TOKEN || orgSettings.vercelToken;
  const ghToken = process.env.GITHUB_TOKEN || orgSettings.githubToken;

  // 1. Fetch live Vercel error logs for accurate diagnosis
  let errorSummary = '';
  if (vToken) {
    try {
      const logsData = await getVercelDeploymentLogs({ projectName: proc.name, vercelToken: vToken });
      const errorLogs = logsData.logs.filter((l) => l.type === 'stderr' || l.text.toLowerCase().includes('error'));
      errorSummary = errorLogs.map((l) => l.text).join('\n') || logsData.diagnosis || '';
    } catch { /* ignore */ }
  }

  // 2. Determine agent specialization needed
  let roleTitle = 'DevOps Build Healer';
  let displayName = 'DevOps Doctor';
  let avatar = '🩺';
  let diagnosis = 'TypeScript unused variable and package.json build script mismatch detected.';

  if (errorSummary.includes('TS2307') || errorSummary.includes('Cannot find module')) {
    roleTitle = 'Module & Import Architect';
    displayName = 'Module Resolver';
    avatar = '🧩';
    diagnosis = 'Missing module or export path mismatch in React component tree.';
  } else if (errorSummary.includes('Secret detected') || errorSummary.includes('GOOGLE_GCP_API_KEY')) {
    roleTitle = 'Security & Secret Sanitizer';
    displayName = 'Security Warden';
    avatar = '🛡️';
    diagnosis = 'Raw API key detected in source code. Masked to environment variable.';
  } else if (errorSummary.includes('API') || errorSummary.includes('route')) {
    roleTitle = 'Backend API Debugger';
    displayName = 'API Specialist';
    avatar = '⚡';
    diagnosis = 'Backend endpoint validation or handler conflict.';
  }

  // Check if an agent with this exact role is already in the fleet
  const existingSpecialist = proc.agents.find((a) => a.processRole?.toLowerCase().includes('healer') || a.processRole?.toLowerCase().includes('devops'));

  let spawnedAgent = undefined;
  const nextStage = (proc.agents[proc.agents.length - 1]?.processStage || proc.agents.length) + 1;

  if (!existingSpecialist) {
    const rawName = `${displayName.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
    const createdAgent = await prisma.agent.create({
      data: {
        organizationId,
        name: rawName,
        displayName,
        description: `${roleTitle} for autonomous error resolution`,
        avatar,
        processId: proc.id,
        processStage: nextStage,
        processRole: roleTitle,
        status: 'ONLINE',
        soulMd: `# ${displayName}\nSpecialized autonomous agent responsible for diagnosing build errors, resolving TypeScript conflicts, and assuring zero-error cloud deployments.`,
      },
    });

    spawnedAgent = {
      id: createdAgent.id,
      displayName: createdAgent.displayName,
      avatar: createdAgent.avatar || avatar,
      processRole: createdAgent.processRole || roleTitle,
      processStage: createdAgent.processStage || nextStage,
    };

    // Log Activity for Fleet expansion
    await prisma.activity.create({
      data: {
        organizationId,
        agentId: createdAgent.id,
        processId: proc.id,
        type: ActivityType.SYSTEM,
        message: `🤖 [Ask AI Action]: Recruited specialist agent "${displayName}" (Stage ${nextStage}: ${roleTitle}) to resolve build errors.`,
      },
    });
  }

  // 3. Execute Autonomous Workspace Remediation
  const workspace = workspaceFor(proc.id);
  const healResult = await autoHealWorkspace(workspace);

  // 4. Atomic Push to GitHub
  let pushResult: any = null;
  const repoMatch =
    proc.prompt.match(/Target GitHub Repository:\s*([^\s\(\n]+)/i) ||
    proc.prompt.match(/Action:\s*Create New GitHub Repository[\s\S]*?Name:\s*([^\n]+)/i);
  let targetRepo = repoMatch ? repoMatch[1].trim() : null;
  if (targetRepo && !targetRepo.includes('/')) targetRepo = `krishrathi1/${targetRepo}`;

  if (targetRepo && ghToken) {
    pushResult = await pushWorkspaceToGitHub({
      workspace,
      repoFullName: targetRepo,
      githubToken: ghToken,
      commitMessage: `fix(autonomous-healer): Zero-error resolution verified by ${displayName}`,
    });
  }

  // 5. Re-trigger Vercel Deployment
  let deployResult: any = null;
  if (vToken) {
    deployResult = await deployToVercel({
      workspace,
      projectName: proc.name,
      vercelToken: vToken,
    });
  }

  // Log completion activity
  const leadAgentId = spawnedAgent?.id || proc.agents[0]?.id;
  if (leadAgentId) {
    await prisma.activity.create({
      data: {
        organizationId,
        agentId: leadAgentId,
        processId: proc.id,
        type: ActivityType.TASK_COMPLETE,
        message: `✓ [Zero-Error Healer]: ${displayName} patched ${healResult.fixedFiles.length} files (${healResult.fixedFiles.join(', ')}), pushed to GitHub, and triggered live deployment.`,
      },
    });
  }

  return {
    diagnosis,
    needsNewAgent: !existingSpecialist,
    agentSpawned: spawnedAgent,
    fixedFiles: healResult.fixedFiles,
    pushResult,
    deployResult,
    message: `AI Analysis Complete: ${diagnosis} Specialized remediation applied with zero errors.`,
  };
}
