import { Router } from 'express';
import { intParam } from '../lib/query.js';
import * as approvalService from '../services/approval.service.js';
import * as runner from '../services/agent-runner.service.js';
import { prisma } from '../lib/prisma.js';
import type { ApprovalStatus } from '@prisma/client';
import { sendError } from '../lib/http-error.js';

const router = Router();

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
/** Normalises a ?status= filter; undefined when absent, null when invalid. */
function statusParam(v: unknown): ApprovalStatus | undefined | null {
  if (typeof v !== 'string' || v === '') return undefined;
  const up = v.toUpperCase();
  return (STATUSES as readonly string[]).includes(up) ? (up as ApprovalStatus) : null;
}

router.get('/', async (req, res) => {
  const status = statusParam(req.query.status);
  if (status === null) return res.status(400).json({ error: 'status must be PENDING, APPROVED or REJECTED' });
  const approvals = await approvalService.getApprovals(req.organizationId!, {
    boardId: req.query.boardId as string | undefined,
    status,
    limit: intParam(req.query.limit),
  });
  res.json(approvals);
});

router.get('/stats', async (req, res) => {
  const stats = await approvalService.getApprovalStats(req.organizationId!);
  res.json(stats);
});

router.get('/:id', async (req, res) => {
  const approval = await approvalService.getApprovalById(req.params.id, req.organizationId!);
  if (!approval) return res.status(404).json({ error: 'Approval not found' });
  res.json(approval);
});

router.post('/', async (req, res) => {
  const { boardId, taskId, taskIds, agentId, actionType, payload, confidence, rubricScores } = req.body;
  if (!boardId || !actionType) {
    return res.status(400).json({ error: 'boardId and actionType are required' });
  }
  if (typeof actionType !== 'string' || actionType.length > 100) {
    return res.status(400).json({ error: 'actionType must be a string of at most 100 characters' });
  }
  if (confidence !== undefined && confidence !== null && (typeof confidence !== 'number' || !(confidence >= 0 && confidence <= 1))) {
    return res.status(400).json({ error: 'confidence must be a number between 0 and 1' });
  }
  try {
    const approval = await approvalService.createApproval(req.organizationId!, {
      boardId, taskId, taskIds, agentId, actionType, payload, confidence, rubricScores,
    });
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('approval:created', approval);
    res.status(201).json(approval);
  } catch (e: any) {
    return sendError(res, e, 404);
  }
});

router.post('/:id/approve', async (req, res) => {
  const approval = await approvalService.resolveApproval(req.params.id, req.organizationId!, 'APPROVED');
  const io = req.app.get('io');
  io?.to(`org:${req.organizationId}`).emit('approval:resolved', approval);

  // If this approval was a stage gate approval, also resolve chainApproval and resume chain
  if (approval.actionType === 'STAGE_GATE_APPROVAL' && approval.payload && typeof approval.payload === 'object') {
    const payload = approval.payload as any;
    if (payload.processId) {
      const gate = await prisma.chainApproval.findFirst({
        where: { processId: payload.processId, status: 'PENDING', organizationId: req.organizationId! },
      });
      if (gate) {
        await prisma.chainApproval.update({
          where: { id: gate.id },
          data: { status: 'APPROVED', decidedAt: new Date() },
        });
        const emit = (event: string, p: unknown) =>
          io?.to(`org:${req.organizationId}`).emit(event, p);
        if (!runner.isRunning(gate.processId)) {
          runner.startChainRun(gate.processId, req.organizationId!, emit, 'RETRY', gate.stage);
        }
        emit('gate:decided', { id: gate.id, status: 'APPROVED', processId: gate.processId });
      }
    }
  }

  res.json(approval);
});

router.post('/:id/reject', async (req, res) => {
  const approval = await approvalService.resolveApproval(req.params.id, req.organizationId!, 'REJECTED');
  const io = req.app.get('io');
  io?.to(`org:${req.organizationId}`).emit('approval:resolved', approval);

  // If this approval was a stage gate approval, mark chainApproval as REJECTED
  if (approval.actionType === 'STAGE_GATE_APPROVAL' && approval.payload && typeof approval.payload === 'object') {
    const payload = approval.payload as any;
    if (payload.processId) {
      const gate = await prisma.chainApproval.findFirst({
        where: { processId: payload.processId, status: 'PENDING', organizationId: req.organizationId! },
      });
      if (gate) {
        await prisma.chainApproval.update({
          where: { id: gate.id },
          data: { status: 'REJECTED', decidedAt: new Date() },
        });
        io?.to(`org:${req.organizationId}`).emit('gate:decided', { id: gate.id, status: 'REJECTED', processId: gate.processId });
      }
    }
  }

  res.json(approval);
});

router.delete('/:id', async (req, res) => {
  await prisma.approval.deleteMany({
    where: { id: req.params.id, board: { organizationId: req.organizationId! } },
  });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('approval:deleted', { id: req.params.id });
  res.json({ success: true });
});

router.delete('/', async (req, res) => {
  const status = statusParam(req.query.status);
  if (status === null) return res.status(400).json({ error: 'status must be PENDING, APPROVED or REJECTED' });
  await prisma.approval.deleteMany({
    where: {
      board: { organizationId: req.organizationId! },
      ...(status ? { status } : {}),
    },
  });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('approval:cleared');
  res.json({ success: true });
});

export default router;
