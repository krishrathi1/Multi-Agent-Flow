import { Router } from 'express';
import { intParam } from '../lib/query.js';
import * as approvalService from '../services/approval.service.js';
import * as runner from '../services/agent-runner.service.js';
import { prisma } from '../lib/prisma.js';
import type { ApprovalStatus } from '@prisma/client';

const router = Router();

router.get('/', async (req, res) => {
  const approvals = await approvalService.getApprovals(req.organizationId!, {
    boardId: req.query.boardId as string | undefined,
    status: req.query.status as ApprovalStatus | undefined,
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
  try {
    const approval = await approvalService.createApproval(req.organizationId!, {
      boardId, taskId, taskIds, agentId, actionType, payload, confidence, rubricScores,
    });
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('approval:created', approval);
    res.status(201).json(approval);
  } catch (e: any) {
    return res.status(e.statusCode || 404).json({ error: e.message });
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

export default router;
