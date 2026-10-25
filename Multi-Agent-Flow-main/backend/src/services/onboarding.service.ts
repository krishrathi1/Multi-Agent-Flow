import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { Prisma } from '@prisma/client';

export async function startSession(boardId: string, organizationId: string) {
  const board = await prisma.board.findFirst({ where: { id: boardId, organizationId } });
  if (!board) throw new Error('Board not found');

  // Check for existing active session
  const existing = await prisma.boardOnboardingSession.findFirst({
    where: { boardId, status: 'IN_PROGRESS' },
  });
  if (existing) return existing;

  const welcomeMessage = {
    role: 'assistant',
    content: `Welcome to board onboarding for "${board.name}"! I'll help you set up your board. Let's start — what's the main goal or objective for this board?`,
    timestamp: new Date().toISOString(),
  };

  return prisma.boardOnboardingSession.create({
    data: {
      boardId,
      messages: [welcomeMessage] as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function sendMessage(sessionId: string, content: string) {
  const session = await prisma.boardOnboardingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'IN_PROGRESS') throw new Error('Session not found or completed');

  const messages = (session.messages as unknown as Array<{ role: string; content: string; timestamp: string }>) || [];
  const userMessage = { role: 'user', content, timestamp: new Date().toISOString() };
  messages.push(userMessage);

  // Generate contextual response based on message count
  const step = messages.filter(m => m.role === 'user').length;
  let responseContent: string;
  let draftGoal: Record<string, unknown> = (session.draftGoal as Record<string, unknown>) || {};

  switch (step) {
    case 1:
      draftGoal = { objective: content };
      responseContent = 'Great objective! What metrics will define success for this board? (e.g., "All tasks completed by Friday", "Zero critical bugs")';
      break;
    case 2:
      draftGoal = { ...draftGoal, successMetrics: content };
      responseContent = 'How much autonomy should agents have? Choose one:\n- **Full autonomy** — agents work independently\n- **Supervised** — agents need approval before completing tasks\n- **Manual** — human controls all task progression';
      break;
    case 3: {
      const autonomy = content.toLowerCase();
      const isFullAutonomy = autonomy.includes('full') || autonomy.includes('independent');
      const isManual = autonomy.includes('manual') || autonomy.includes('human');
      draftGoal = {
        ...draftGoal,
        autonomyLevel: isFullAutonomy ? 'full' : isManual ? 'manual' : 'supervised',
        requireApprovalForDone: !isFullAutonomy,
        requireReviewBeforeDone: isManual,
      };
      responseContent = `Got it! Here's your board configuration:\n- **Objective:** ${draftGoal.objective}\n- **Success Metrics:** ${draftGoal.successMetrics}\n- **Autonomy:** ${draftGoal.autonomyLevel}\n\nReady to apply these settings? Reply "confirm" to finalize or continue chatting to adjust.`;
      break;
    }
    default:
      responseContent = 'Reply "confirm" to finalize your board setup, or tell me what you\'d like to change.';
  }

  const assistantMessage = { role: 'assistant', content: responseContent, timestamp: new Date().toISOString() };
  messages.push(assistantMessage);

  return prisma.boardOnboardingSession.update({
    where: { id: sessionId },
    data: {
      messages: messages as unknown as Prisma.InputJsonValue,
      draftGoal: draftGoal as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getSession(boardId: string) {
  return prisma.boardOnboardingSession.findFirst({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function confirmOnboarding(sessionId: string, organizationId: string) {
  const session = await prisma.boardOnboardingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== 'IN_PROGRESS') throw new Error('Session not found or already completed');

  const draftGoal = session.draftGoal as Record<string, unknown> | null;

  // Apply settings to board
  if (draftGoal) {
    const updateData: Record<string, unknown> = {};
    if (draftGoal.objective) updateData.objective = String(draftGoal.objective);
    if (draftGoal.successMetrics) updateData.successMetrics = [String(draftGoal.successMetrics)];
    if (draftGoal.requireApprovalForDone !== undefined) updateData.requireApprovalForDone = Boolean(draftGoal.requireApprovalForDone);
    if (draftGoal.requireReviewBeforeDone !== undefined) updateData.requireReviewBeforeDone = Boolean(draftGoal.requireReviewBeforeDone);

    await prisma.board.update({
      where: { id: session.boardId, organizationId },
      data: updateData,
    });
    logger.info({ boardId: session.boardId, draftGoal }, 'Applied onboarding settings to board');
  }

  return prisma.boardOnboardingSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED' },
  });
}
