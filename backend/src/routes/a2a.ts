import { Router } from 'express';
import { z } from 'zod';
import { runA2AInteroperability } from '../services/a2a-orchestrator.service.js';

export const a2aRouter = Router();

const executeSchema = z.object({
  goal: z.string().min(1).max(1000).default('Implement secure microservice and verify functionality'),
});

a2aRouter.get('/specs', (_req, res) => {
  res.json({
    protocol: 'A2A/v1',
    status: 'ACTIVE',
    frameworks: {
      crewai: {
        status: 'INTEGRATED',
        version: '1.15.28',
        role_support: ['Manager', 'Worker', 'Reviewer'],
        delegation: true
      },
      adk: {
        status: 'INTEGRATED',
        specification: 'Google ADK v1.0',
        tool_binding: true,
        sandboxed_execution: true
      }
    },
    message_envelope: {
      headers: ['protocol', 'message_id', 'timestamp', 'sender', 'recipient', 'intent'],
      payload_contracts: ['PydanticSchema/v2', 'JSON-RPC/2.0']
    }
  });
});

a2aRouter.post('/execute', async (req, res) => {
  try {
    const { goal } = executeSchema.parse(req.body);
    const result = await runA2AInteroperability(goal);
    res.json({ ok: true, data: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
