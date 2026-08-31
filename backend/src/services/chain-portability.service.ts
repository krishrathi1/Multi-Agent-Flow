import { z } from 'zod';
import { ApprovalMode } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { createProcess } from './process.service.js';
import type { ProcessPlan } from './process-planner.js';

/**
 * Moving a production chain between environments.
 *
 * A chain that took real money to plan and tune was previously trapped in the
 * database that made it — there was no way to move a proven roster from a dev
 * org to production, hand it to a teammate, or keep it in version control.
 * Export produces a self-contained bundle; import rebuilds the chain from one.
 *
 * Deliberately excluded: run history, artifacts, share tokens and schedules.
 * A bundle describes *how to run a chain*, not what happened when it did —
 * and carrying a share token across an import would silently clone a secret.
 */

/** Bumped when the shape changes incompatibly. */
export const CHAIN_BUNDLE_VERSION = 1;

const agentSchema = z.object({
  name: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  role: z.string().max(500).default(''),
  description: z.string().max(2000).default(''),
  stage: z.number().int().min(1).max(64),
  soulMd: z.string().max(20_000).default(''),
  heartbeatInterval: z.number().int().min(1).max(86_400).default(60),
  avatar: z.string().max(500).nullable().default(null),
});

export const chainBundleSchema = z.object({
  nexusChainVersion: z.number().int().positive(),
  name: z.string().min(1).max(200),
  prompt: z.string().min(1).max(20_000),
  summary: z.string().max(4000).optional(),
  plannedBy: z.string().max(120).optional(),
  guidance: z.string().max(20_000).nullable().optional(),
  guardrails: z
    .object({
      approvalMode: z.nativeEnum(ApprovalMode).optional(),
      budgetUsd: z.number().min(0).max(100_000).nullable().optional(),
      maxTokens: z.number().int().min(0).max(100_000_000).nullable().optional(),
    })
    .optional(),
  // At least one agent, or there is no chain to rebuild.
  agents: z.array(agentSchema).min(1).max(64),
  stages: z
    .array(z.object({ stage: z.number().int(), label: z.string().max(200) }))
    .optional(),
});

export type ChainBundle = z.infer<typeof chainBundleSchema>;

/** Serialises a chain into a portable bundle. Returns null if not found. */
export async function exportChain(
  processId: string,
  organizationId: string,
): Promise<ChainBundle | null> {
  const proc = await prisma.process.findFirst({
    where: { id: processId, organizationId },
    include: {
      agents: {
        orderBy: [{ processStage: 'asc' }, { displayName: 'asc' }],
        select: {
          name: true,
          displayName: true,
          description: true,
          soulMd: true,
          avatar: true,
          heartbeatInterval: true,
          processRole: true,
          processStage: true,
        },
      },
    },
  });
  if (!proc) return null;

  const plan = proc.plan as ProcessPlan | null;

  return {
    nexusChainVersion: CHAIN_BUNDLE_VERSION,
    name: proc.name,
    prompt: proc.prompt,
    summary: proc.summary ?? undefined,
    plannedBy: proc.plannedBy ?? undefined,
    guidance: proc.guidance,
    guardrails: {
      approvalMode: proc.approvalMode,
      budgetUsd: proc.budgetUsd,
      maxTokens: proc.maxTokens,
    },
    agents: proc.agents.map((a) => ({
      name: a.name,
      displayName: a.displayName,
      role: a.processRole ?? '',
      description: a.description,
      // A stage of 0 would place an agent before the first stage the runner
      // iterates; clamp rather than emit a bundle that imports into a chain
      // whose first stage never executes.
      stage: Math.max(1, a.processStage),
      soulMd: a.soulMd ?? '',
      heartbeatInterval: a.heartbeatInterval,
      avatar: a.avatar,
    })),
    stages: plan?.stages,
  };
}

export interface ImportResult {
  ok: boolean;
  /** Present when ok — the newly created chain. */
  processId?: string;
  name?: string;
  /** Present when the bundle was rejected. */
  error?: string;
  issues?: string[];
}

/**
 * Rebuilds a chain from a bundle.
 *
 * The plan is reused verbatim rather than re-planned, so an imported chain is
 * the roster that was proven elsewhere — not a fresh guess that happens to
 * share a prompt. Names are de-duplicated by createProcess, so importing the
 * same bundle twice yields two distinct chains instead of a collision.
 */
export async function importChain(
  organizationId: string,
  raw: unknown,
): Promise<ImportResult> {
  const parsed = chainBundleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'That does not look like a MyceliumOps chain bundle.',
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'bundle'}: ${i.message}`),
    };
  }

  const bundle = parsed.data;
  if (bundle.nexusChainVersion > CHAIN_BUNDLE_VERSION) {
    return {
      ok: false,
      error:
        `This bundle was exported by a newer version (v${bundle.nexusChainVersion}); ` +
        `this server understands up to v${CHAIN_BUNDLE_VERSION}.`,
    };
  }

  // Stages are renumbered to be contiguous from 1. A bundle hand-edited to
  // stages [1, 5, 9] would otherwise leave the runner iterating empty stages.
  const ordered = [...new Set(bundle.agents.map((a) => a.stage))].sort((a, b) => a - b);
  const stageMap = new Map(ordered.map((s, i) => [s, i + 1]));

  const plan: ProcessPlan = {
    name: bundle.name,
    summary: bundle.summary ?? '',
    plannedBy: bundle.plannedBy ?? 'imported',
    agents: bundle.agents.map((a) => ({
      name: a.name,
      displayName: a.displayName,
      role: a.role,
      description: a.description,
      stage: stageMap.get(a.stage) ?? 1,
      soulMd: a.soulMd,
      heartbeatInterval: a.heartbeatInterval,
      avatar: a.avatar,
    })),
    stages: ordered.map((s, i) => ({
      stage: i + 1,
      label: bundle.stages?.find((x) => x.stage === s)?.label ?? `Stage ${i + 1}`,
    })),
  };

  let created: Awaited<ReturnType<typeof createProcess>>;
  try {
    created = await createProcess(organizationId, {
      prompt: bundle.prompt,
      name: bundle.name,
      plan,
    });
  } catch (err) {
    // Two imports racing on the same name can still collide on the unique
    // index even though names are de-duplicated. Report it as a rejected
    // bundle rather than letting a 500 escape.
    logger.warn({ err, organizationId }, 'Chain import failed');
    return {
      ok: false,
      error: 'Could not create the chain from that bundle. Try again.',
      issues: [(err as Error).message],
    };
  }
  if (!created) return { ok: false, error: 'Could not create the chain.' };

  // Guardrails are applied after creation — createProcess owns the roster, not
  // the spend policy. An imported budget must carry over or the chain arrives
  // uncapped, which is the dangerous default.
  const g = bundle.guardrails;
  if (g || bundle.guidance) {
    await prisma.process.update({
      where: { id: created.id },
      data: {
        ...(g?.approvalMode ? { approvalMode: g.approvalMode } : {}),
        ...(g?.budgetUsd !== undefined ? { budgetUsd: g.budgetUsd } : {}),
        ...(g?.maxTokens !== undefined ? { maxTokens: g.maxTokens } : {}),
        ...(bundle.guidance !== undefined ? { guidance: bundle.guidance } : {}),
      },
    });
  }

  logger.info(
    { processId: created.id, organizationId, agents: plan.agents.length },
    'Chain imported from bundle',
  );

  return { ok: true, processId: created.id, name: created.name };
}
