import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as agentService from '../services/agent.service.js';
import * as agentSkillService from '../services/agent-skill.service.js';
import * as integrationService from '../services/integration.service.js';
import * as activityService from '../services/activity.service.js';
import * as llmProviderService from '../services/llm-provider.service.js';
import * as localChat from '../services/agent-chat.service.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getGatewayClient } from '../openclaw/client.js';
import type { AgentStatus, ChannelType } from '@prisma/client';

const router = Router();

router.get('/', async (req, res) => {
  const agents = await agentService.getAllAgents(req.organizationId!);
  res.json(agents);
});

router.get('/stats', async (req, res) => {
  const stats = await agentService.getAgentStats(req.organizationId!);
  res.json(stats);
});

router.get('/:id', async (req, res) => {
  const agent = await agentService.getAgentById(req.params.id, req.organizationId!);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

router.post('/', async (req, res) => {
  const agent = await agentService.createAgent(req.organizationId!, req.body);
  // Bulk-assign skills if provided
  if (req.body.skillIds && Array.isArray(req.body.skillIds) && req.body.skillIds.length > 0) {
    await agentSkillService.bulkAssignSkills(agent.id, req.body.skillIds, req.organizationId!);
  }
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:created', agent);
  res.status(201).json(agent);
});

router.patch('/:id', async (req, res) => {
  const agent = await agentService.updateAgent(req.params.id, req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', agent);
  res.json(agent);
});

router.patch('/:id/status', async (req, res) => {
  const { status, currentTask } = req.body as { status: AgentStatus; currentTask?: string };
  const agent = await agentService.updateAgentStatus(req.params.id, req.organizationId!, status, currentTask);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:status', agent);
  res.json(agent);
});

// ─── Agent-to-Agent toggle ──────────────────────────────
router.patch('/:id/a2a', async (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  const agent = await agentService.updateAgent(req.params.id, req.organizationId!, { agentToAgent: enabled } as any);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', agent);
  res.json(agent);
});

// ─── Heartbeat Throttling ────────────────────────────────
// Prevent DB bloat and CPU waste from frequent heartbeats
const heartbeatActivityThrottle = new Map<string, number>(); // agentId -> last activity write time
const heartbeatRateLimit = new Map<string, number>();         // agentId -> last heartbeat time
const HEARTBEAT_ACTIVITY_INTERVAL_MS = 5 * 60 * 1000; // Only log activity every 5 min
const HEARTBEAT_RATE_LIMIT_MS = 5 * 1000;              // Reject heartbeats faster than 5s apart

router.post('/:id/heartbeat', async (req, res) => {
  const agentId = req.params.id;
  const now = Date.now();

  // Rate limit: reject if heartbeat came in within 5 seconds
  const lastPing = heartbeatRateLimit.get(agentId);
  if (lastPing && now - lastPing < HEARTBEAT_RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Too many heartbeats', retryAfterMs: HEARTBEAT_RATE_LIMIT_MS - (now - lastPing) });
  }
  heartbeatRateLimit.set(agentId, now);

  const agent = await agentService.recordHeartbeat(agentId, req.organizationId!);

  // Throttle activity creation: only write to DB every 5 minutes per agent
  const lastActivity = heartbeatActivityThrottle.get(agentId);
  if (!lastActivity || now - lastActivity >= HEARTBEAT_ACTIVITY_INTERVAL_MS) {
    heartbeatActivityThrottle.set(agentId, now);
    await activityService.createActivity(req.organizationId!, {
      agentId: agent.id,
      type: 'HEARTBEAT',
      message: req.body.message || `Heartbeat from ${agent.displayName}`,
      metadata: req.body.metadata,
    });

    // Create a timeline Session record for heartbeats (throttled same as activity)
    prisma.session.create({
      data: {
        organizationId: req.organizationId!,
        agentId: agent.id,
        type: 'HEARTBEAT',
        status: 'COMPLETED',
        startedAt: new Date(),
        endedAt: new Date(),
        durationMs: 0,
        summary: req.body.message || `Heartbeat from ${agent.displayName}`,
      },
    }).catch(() => {});
  }

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:heartbeat', agent);
  res.json(agent);
});

router.delete('/:id', async (req, res) => {
  await agentService.deleteAgent(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:deleted', { id: req.params.id });
  res.status(204).end();
});

// ─── Agent Skills ───────────────────────────────────────

router.get('/:id/skills', async (req, res) => {
  const skills = await agentSkillService.listAgentSkills(req.params.id, req.organizationId!);
  res.json(skills);
});

router.post('/:id/skills', async (req, res) => {
  const { skillId, skillIds } = req.body;
  if (skillIds && Array.isArray(skillIds)) {
    const result = await agentSkillService.bulkAssignSkills(req.params.id, skillIds, req.organizationId!);
    return res.json(result);
  }
  if (!skillId) return res.status(400).json({ error: 'skillId is required' });
  const result = await agentSkillService.assignSkill(req.params.id, skillId, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', { id: req.params.id });
  res.status(201).json(result);
});

router.patch('/:id/skills/:skillId', async (req, res) => {
  const result = await agentSkillService.updateAgentSkill(
    req.params.id,
    req.params.skillId,
    req.organizationId!,
    req.body
  );
  res.json(result);
});

router.delete('/:id/skills/:skillId', async (req, res) => {
  await agentSkillService.removeSkill(req.params.id, req.params.skillId, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', { id: req.params.id });
  res.status(204).end();
});

// ─── Chat Endpoints ─────────────────────────────────────

router.get('/mother/history', async (req, res) => {
  try {
    const history = await localChat.getMotherChatHistory(
      req.organizationId!,
      req.query.processId as string | undefined,
    );
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mother/chat', async (req, res) => {
  try {
    const { message, processId, model } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const response = await localChat.chatWithMother(
      req.organizationId!,
      message,
      processId,
      model,
    );
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/chat', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    // No gateway (e.g. agents spawned by a production chain) — run the turn
    // through the local Claude CLI instead of refusing to chat.
    const gatewayReady =
      agent.gatewayId &&
      agent.gatewayAgentId &&
      getGatewayClient(agent.gatewayId)?.isConnected();

    if (!gatewayReady) {
      if (!localChat.isLocalChatAvailable()) {
        return res.status(503).json({
          error:
            'No gateway connected and the local Claude CLI is unavailable. Connect a gateway or enable CLAUDE_CLI_PLANNER.',
        });
      }
      const local = await localChat.chatLocally(
        agent.id,
        req.organizationId!,
        req.body.message as string,
      );
      if (!local) {
        return res.status(502).json({ error: 'Local model did not return a response' });
      }
      req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', {
        id: agent.id,
        status: 'IDLE',
      });
      return res.json({ result: local.result, sessionKey: local.sessionKey, model: local.model });
    }

    const client = getGatewayClient(agent.gatewayId!)!;

    // Resolve LLM API key for this org (BYOK or PLATFORM)
    const resolved = await llmProviderService.resolveApiKey(req.organizationId!);

    // If PLATFORM mode, enforce credit balance
    if (resolved?.mode === 'PLATFORM') {
      try {
        await llmProviderService.checkCreditSufficient(req.organizationId!);
      } catch (creditErr) {
        return res.status(402).json({ error: 'Insufficient platform credits' });
      }
    }

    // ─── A2A: Build peer agent context ─────────────────────────
    let chatMessage = req.body.message as string;
    let peerAgents: Array<{ id: string; name: string; displayName: string; gatewayAgentId: string | null; description: string | null; status: string }> = [];

    if (agent.agentToAgent) {
      peerAgents = await prisma.agent.findMany({
        where: {
          organizationId: req.organizationId!,
          id: { not: agent.id },
          agentToAgent: true,
          enabled: true,
          gatewayAgentId: { not: null },
        },
        select: { id: true, name: true, displayName: true, gatewayAgentId: true, description: true, status: true },
      });

      if (peerAgents.length > 0) {
        const peerList = peerAgents.map(p =>
          `  - "${p.displayName}" (name: ${p.name}, status: ${p.status})${p.description ? ` — ${p.description}` : ''}`
        ).join('\n');

        const a2aContext = [
          '\n\n---',
          '[SYSTEM — Agent-to-Agent Communication]',
          'You have Agent-to-Agent (A2A) communication enabled. The following peer agents are available in your organization:',
          peerList,
          '',
          'To send a message to a peer agent, include a directive in your response using this exact format:',
          '[A2A:agent-name:Your message to the other agent]',
          '',
          'For example: [A2A:agent-1:Can you help me analyze the latest sales data?]',
          'The system will relay your message and include their response. You may include multiple A2A directives.',
          '---',
        ].join('\n');

        chatMessage = chatMessage + a2aContext;
      }
    }

    // Session key format: agent:{gatewayAgentId}:nexus (required by OpenClaw gateway)
    const sessionKey = `agent:${agent.gatewayAgentId}:nexus`;

    // Create a timeline Session record (RUNNING → COMPLETED/FAILED)
    const chatSession = await prisma.session.create({
      data: {
        organizationId: req.organizationId!,
        agentId: agent.id,
        type: 'MESSAGE',
        status: 'RUNNING',
        summary: `Chat: ${(req.body.message as string).slice(0, 120)}`,
      },
    });

    // Mark agent as ONLINE while processing
    await prisma.agent.update({ where: { id: agent.id }, data: { status: 'ONLINE' } });
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', { id: agent.id, status: 'ONLINE' });

    const rpcStart = Date.now();
    let result: unknown;
    let rpcSuccess = true;
    let rpcError: string | undefined;
    try {
      result = await client.rpcExpectFinal('agent', {
        message: chatMessage,
        agentId: agent.gatewayAgentId,
        sessionKey,
        idempotencyKey: randomUUID(),
        label: `MyceliumOps chat with ${agent.displayName}`,
        // Pass resolved API key and provider to Gateway (ignored if null)
        ...(resolved && { apiKey: resolved.apiKey, provider: resolved.provider }),
      });
    } catch (rpcErr) {
      rpcSuccess = false;
      rpcError = (rpcErr as Error).message;

      // Record metrics + session on failure, then return to IDLE
      const responseTimeMs = Date.now() - rpcStart;
      prisma.session.update({
        where: { id: chatSession.id },
        data: { status: 'FAILED', endedAt: new Date(), durationMs: responseTimeMs, summary: `Chat failed: ${rpcError?.slice(0, 120)}` },
      }).catch(() => {});
      prisma.metricSnapshot.create({
        data: { organizationId: req.organizationId!, agentId: agent.id, responseTimeMs, success: false, errorMessage: rpcError, toolName: 'chat' },
      }).catch(() => {});
      await prisma.agent.update({ where: { id: agent.id }, data: { status: 'IDLE' } }).catch(() => {});
      req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', { id: agent.id, status: 'IDLE' });

      throw rpcErr;
    }

    logger.info({ agentId: agent.id, gatewayStatus: (result as any)?.status }, 'Gateway agent RPC completed');

    // Extract text from the gateway's two-phase response.
    // The final payload is: { runId, status, summary, result: { payloads: [{ text, ... }], meta } }
    const gatewayResult = result as Record<string, unknown>;
    const innerResult = gatewayResult?.result as { payloads?: Array<{ text?: string }>; meta?: unknown } | undefined;
    const payloads = innerResult?.payloads ?? [];
    const responseText = payloads.map(p => p.text).filter(Boolean).join('\n') || '';
    const meta = innerResult?.meta as Record<string, unknown> | undefined;

    // Record activity
    await activityService.createActivity(req.organizationId!, {
      agentId: agent.id,
      type: 'MESSAGE',
      message: `Chat message sent to ${agent.displayName}`,
      metadata: { sessionKey },
    });

    // Record token usage from gateway response metadata (fire-and-forget).
    // Works with both BYOK/PLATFORM modes and gateway-managed keys.
    const usage = meta?.usage as { inputTokens?: number; outputTokens?: number; model?: string; cost?: number } | undefined;
    if (usage?.inputTokens && usage?.outputTokens) {
      llmProviderService.recordTokenUsage({
        organizationId: req.organizationId!,
        agentId: agent.id,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model || 'default',
        mode: resolved?.mode || 'BYOK',
      }).catch(() => {}); // fire-and-forget — don't block response on billing

      // Update session with token/cost data
      prisma.session.update({
        where: { id: chatSession.id },
        data: {
          tokensUsed: usage.inputTokens + usage.outputTokens,
          cost: usage.cost ?? null,
        },
      }).catch(() => {});
    }

    // ─── A2A: Relay directives to peer agents ──────────────────
    let finalResponseText = responseText;
    if (agent.agentToAgent && peerAgents.length > 0) {
      const a2aPattern = /\[A2A:([^:]+):([^\]]+)\]/g;
      const directives: Array<{ agentName: string; message: string }> = [];
      let match;
      while ((match = a2aPattern.exec(responseText)) !== null) {
        directives.push({ agentName: match[1].trim(), message: match[2].trim() });
      }

      if (directives.length > 0) {
        const a2aReplies: Array<{ peerName: string; question: string; reply: string }> = [];

        for (const directive of directives) {
          const targetPeer = peerAgents.find(p =>
            p.name === directive.agentName ||
            p.displayName.toLowerCase() === directive.agentName.toLowerCase()
          );

          if (!targetPeer || !targetPeer.gatewayAgentId) {
            a2aReplies.push({ peerName: directive.agentName, question: directive.message, reply: 'Agent not found or not connected.' });
            continue;
          }

          try {
            // Send message to target agent via gateway
            const a2aSessionKey = `agent:${targetPeer.gatewayAgentId}:a2a-from-${agent.gatewayAgentId}`;
            const a2aRelayStart = Date.now();
            const a2aResult = await client.rpcExpectFinal('agent', {
              message: `[Message from agent "${agent.displayName}"]\n\n${directive.message}`,
              agentId: targetPeer.gatewayAgentId,
              sessionKey: a2aSessionKey,
              idempotencyKey: randomUUID(),
              label: `A2A: ${agent.displayName} \u2192 ${targetPeer.displayName}`,
              ...(resolved && { apiKey: resolved.apiKey, provider: resolved.provider }),
            });
            const a2aRelayMs = Date.now() - a2aRelayStart;

            // Extract response text
            const a2aGatewayResult = a2aResult as Record<string, unknown>;
            const a2aInner = a2aGatewayResult?.result as { payloads?: Array<{ text?: string }> } | undefined;
            const a2aText = (a2aInner?.payloads ?? []).map(p => p.text).filter(Boolean).join('\n') || 'No response';

            a2aReplies.push({ peerName: targetPeer.displayName, question: directive.message, reply: a2aText });

            // Create DELEGATION session for the A2A relay (fire-and-forget)
            prisma.session.create({
              data: {
                organizationId: req.organizationId!,
                agentId: targetPeer.id,
                type: 'DELEGATION',
                status: 'COMPLETED',
                endedAt: new Date(),
                durationMs: a2aRelayMs,
                summary: `A2A from ${agent.displayName}: ${directive.message.slice(0, 100)}`,
              },
            }).catch(() => {});

            // Record thread + messages for Communications page
            const [first, second] = [agent.id, targetPeer.id].sort();
            let thread = await prisma.thread.findFirst({
              where: { organizationId: req.organizationId!, messages: { some: { OR: [{ senderId: first, receiverId: second }, { senderId: second, receiverId: first }] } } },
            });
            if (!thread) {
              thread = await prisma.thread.create({ data: { organizationId: req.organizationId!, title: `${agent.displayName} \u2194 ${targetPeer.displayName}` } });
            }
            const agentSelect = { id: true, name: true, displayName: true, avatar: true };

            // Outbound message: source agent → target agent
            const outMsg = await prisma.message.create({
              data: { threadId: thread.id, senderId: agent.id, receiverId: targetPeer.id, content: directive.message, metadata: { gatewayRunId: (a2aGatewayResult as any)?.runId } },
              include: { sender: { select: agentSelect }, receiver: { select: agentSelect } },
            });

            // Reply message: target agent → source agent
            const replyMsg = await prisma.message.create({
              data: { threadId: thread.id, senderId: targetPeer.id, receiverId: agent.id, content: a2aText, metadata: { gatewayRunId: (a2aGatewayResult as any)?.runId, direction: 'reply' } },
              include: { sender: { select: agentSelect }, receiver: { select: agentSelect } },
            });

            await prisma.thread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });

            // Emit real-time events
            const io = req.app.get('io');
            const room = `org:${req.organizationId}`;
            io?.to(room).emit('thread:message', { threadId: thread.id, message: outMsg });
            io?.to(room).emit('thread:message', { threadId: thread.id, message: replyMsg });
            io?.to(room).emit('agent:message', {
              sourceAgent: { id: agent.id, name: agent.displayName },
              targetAgent: { id: targetPeer.id, name: targetPeer.displayName },
              message: directive.message,
              threadId: thread.id,
              timestamp: new Date().toISOString(),
            });

            // Record activity for both agents
            await activityService.createActivity(req.organizationId!, {
              agentId: agent.id, type: 'DELEGATION', message: `${agent.displayName} sent A2A message to ${targetPeer.displayName}`,
              metadata: { targetAgentId: targetPeer.id, direction: 'outbound' },
            });
            await activityService.createActivity(req.organizationId!, {
              agentId: targetPeer.id, type: 'DELEGATION', message: `Received A2A message from ${agent.displayName}`,
              metadata: { sourceAgentId: agent.id, direction: 'inbound' },
            });

            logger.info({ from: agent.displayName, to: targetPeer.displayName }, 'A2A message relayed');
          } catch (err) {
            logger.warn({ from: agent.displayName, to: directive.agentName, err }, 'A2A relay failed');
            a2aReplies.push({ peerName: directive.agentName, question: directive.message, reply: `Error — ${(err as Error).message}` });
          }
        }

        // ─── Inject A2A replies back into the agent's session ────
        // This is critical: without this, the source agent has no memory
        // of what the peer agents replied. We send the replies as a
        // follow-up user message so the agent can read and react to them.
        if (a2aReplies.length > 0) {
          const replyNotification = a2aReplies.map(r =>
            `[A2A Reply from "${r.peerName}"]\nYour message: "${r.question}"\nTheir response:\n${r.reply}`
          ).join('\n\n---\n\n');

          const followUpMessage = `[SYSTEM — A2A Responses Received]\nThe following agents have replied to your messages:\n\n${replyNotification}\n\nPlease summarize the conversation for the user. Do NOT include any [A2A:...] directives in this response.`;

          try {
            const followUpResult = await client.rpcExpectFinal('agent', {
              message: followUpMessage,
              agentId: agent.gatewayAgentId,
              sessionKey,
              idempotencyKey: randomUUID(),
              label: `A2A follow-up: ${agent.displayName} processes replies`,
              ...(resolved && { apiKey: resolved.apiKey, provider: resolved.provider }),
            });

            // Extract the agent's reaction to the A2A replies
            const followUpGateway = followUpResult as Record<string, unknown>;
            const followUpInner = followUpGateway?.result as { payloads?: Array<{ text?: string }> } | undefined;
            const followUpText = (followUpInner?.payloads ?? []).map(p => p.text).filter(Boolean).join('\n') || '';

            if (followUpText) {
              // Replace the original response (which had raw [A2A:...] directives)
              // with the agent's summary that includes the actual peer replies
              finalResponseText = followUpText;
            }
          } catch (followUpErr) {
            logger.warn({ agent: agent.displayName, err: followUpErr }, 'A2A follow-up failed, falling back to raw replies');
            // Fallback: strip directives and append raw replies
            const stripped = responseText.replace(a2aPattern, '').trim();
            const rawReplies = a2aReplies.map(r => `**${r.peerName} replied:**\n${r.reply}`).join('\n\n');
            finalResponseText = stripped + '\n\n' + rawReplies;
          }
        }
      }
    }

    res.json({
      status: gatewayResult?.status || 'ok',
      result: finalResponseText,
      runId: gatewayResult?.runId,
    });

    // ─── Post-response cleanup: return agent to IDLE, finalize session & metrics ──
    const responseTimeMs = Date.now() - rpcStart;
    await prisma.agent.update({ where: { id: agent.id }, data: { status: 'IDLE' } }).catch(() => {});
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:updated', { id: agent.id, status: 'IDLE' });

    prisma.session.update({
      where: { id: chatSession.id },
      data: { status: 'COMPLETED', endedAt: new Date(), durationMs: responseTimeMs, summary: `Chat: ${(req.body.message as string).slice(0, 120)}` },
    }).catch(() => {});
    prisma.metricSnapshot.create({
      data: { organizationId: req.organizationId!, agentId: agent.id, responseTimeMs, success: true, toolName: 'chat' },
    }).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/chat/history', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const historyClient =
      agent.gatewayId && agent.gatewayAgentId ? getGatewayClient(agent.gatewayId) : null;

    if (!historyClient || !historyClient.isConnected()) {
      // Local chats are stored as activities, so history still works.
      return res.json(await localChat.getLocalChatHistory(agent.id, req.organizationId!));
    }
    const client = historyClient;

    // Session key format: agent:{gatewayAgentId}:nexus (required by OpenClaw gateway)
    const sessionKey = `agent:${agent.gatewayAgentId}:nexus`;

    const result = await client.rpc('chat.history', {
      sessionKey,
      limit: Number(req.query.limit) || 50,
    }) as { sessionKey?: string; sessionId?: string; messages?: Array<{ role: string; content: unknown; timestamp?: number }> };

    // Normalize gateway messages: content can be an array of content blocks
    // (text, toolCall, toolResult) — flatten to plain text strings and filter
    // out tool-call / tool-result turns that have no user-visible text.
    const messages = (result?.messages ?? [])
      .map(msg => {
        let text: string;
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = (msg.content as Array<{ type?: string; text?: string }>)
            .filter(block => block.type === 'text' && block.text)
            .map(block => block.text!)
            .join('\n');
        } else {
          text = '';
        }
        return { role: msg.role, content: text, timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : undefined };
      })
      .filter(msg => (msg.role === 'user' || msg.role === 'assistant') && msg.content);

    res.json({ sessionKey, messages });
  } catch (err) {
    res.json({ sessionKey: '', messages: [] });
  }
});

// ─── Workspace File Endpoints ───────────────────────────

router.get('/:id/files', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!agent.gatewayId || !agent.gatewayAgentId) {
      return res.json([]);
    }

    const client = getGatewayClient(agent.gatewayId);
    if (!client || !client.isConnected()) {
      return res.json([]);
    }

    const result = await client.rpc('agents.files.list', { agentId: agent.gatewayAgentId }) as { files: unknown[] };
    res.json(result.files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/files/:name', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!agent.gatewayId || !agent.gatewayAgentId) {
      return res.status(400).json({ error: 'Agent not connected to gateway' });
    }

    const client = getGatewayClient(agent.gatewayId);
    if (!client || !client.isConnected()) {
      return res.status(503).json({ error: 'Gateway not connected' });
    }

    const result = await client.rpc('agents.files.get', {
      agentId: agent.gatewayAgentId,
      name: decodeURIComponent(req.params.name),
    }) as { file: unknown };
    res.json(result.file);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id/files/:name', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!agent.gatewayId || !agent.gatewayAgentId) {
      return res.status(400).json({ error: 'Agent not connected to gateway' });
    }

    const client = getGatewayClient(agent.gatewayId);
    if (!client || !client.isConnected()) {
      return res.status(503).json({ error: 'Gateway not connected' });
    }

    const result = await client.rpc('agents.files.set', {
      agentId: agent.gatewayAgentId,
      name: decodeURIComponent(req.params.name),
      content: req.body.content,
    }) as { file: unknown };
    res.json(result.file);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Agent-to-Agent Messaging ─────────────────────────

router.post('/:id/message', async (req, res) => {
  try {
    const { targetAgentId, message } = req.body;
    if (!targetAgentId || !message) {
      return res.status(400).json({ error: 'targetAgentId and message are required' });
    }

    // Get source agent
    const sourceAgent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!sourceAgent) return res.status(404).json({ error: 'Source agent not found' });
    if (!sourceAgent.gatewayId || !sourceAgent.gatewayAgentId) {
      return res.status(400).json({ error: 'Source agent not connected to a gateway' });
    }

    // Get target agent (must be in same org)
    const targetAgent = await prisma.agent.findFirst({
      where: { id: targetAgentId, organizationId: req.organizationId! },
    });
    if (!targetAgent) return res.status(404).json({ error: 'Target agent not found in this organization' });
    if (!targetAgent.gatewayAgentId) {
      return res.status(400).json({ error: 'Target agent not connected to a gateway' });
    }

    // Both agents must be on the same gateway for agent-to-agent comms
    if (sourceAgent.gatewayId !== targetAgent.gatewayId) {
      return res.status(400).json({ error: 'Agents must be on the same gateway for direct messaging' });
    }

    const client = getGatewayClient(sourceAgent.gatewayId);
    if (!client || !client.isConnected()) {
      return res.status(503).json({ error: 'Gateway not connected' });
    }

    // Resolve LLM API key for this org (BYOK or PLATFORM)
    const resolved = await llmProviderService.resolveApiKey(req.organizationId!);

    // If PLATFORM mode, enforce credit balance
    if (resolved?.mode === 'PLATFORM') {
      try {
        await llmProviderService.checkCreditSufficient(req.organizationId!);
      } catch (creditErr) {
        return res.status(402).json({ error: 'Insufficient platform credits' });
      }
    }

    // Send message to target agent. Session key must match target agentId (gateway validates this).
    const sessionKey = `agent:${targetAgent.gatewayAgentId}:a2a-from-${sourceAgent.gatewayAgentId}`;
    const result = await client.rpc('agent', {
      message: `[Message from agent "${sourceAgent.displayName}" to agent "${targetAgent.displayName}"]\n\n${message}`,
      agentId: targetAgent.gatewayAgentId,
      sessionKey,
      idempotencyKey: randomUUID(),
      label: `Agent-to-agent: ${sourceAgent.displayName} → ${targetAgent.displayName}`,
      // Pass resolved API key and provider to Gateway (ignored if null)
      ...(resolved && { apiKey: resolved.apiKey, provider: resolved.provider }),
    });

    // Find or create a thread for this agent pair
    const [first, second] = [sourceAgent.id, targetAgent.id].sort();
    let thread = await prisma.thread.findFirst({
      where: {
        organizationId: req.organizationId!,
        messages: {
          some: {
            OR: [
              { senderId: first, receiverId: second },
              { senderId: second, receiverId: first },
            ],
          },
        },
      },
    });

    if (!thread) {
      thread = await prisma.thread.create({
        data: {
          organizationId: req.organizationId!,
          title: `${sourceAgent.displayName} ↔ ${targetAgent.displayName}`,
        },
      });
    }

    // Create Message record for Communications page
    const agentSelect = { id: true, name: true, displayName: true, avatar: true };
    const dbMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: sourceAgent.id,
        receiverId: targetAgent.id,
        content: message,
        metadata: { gatewayRunId: (result as any)?.runId },
      },
      include: {
        sender: { select: agentSelect },
        receiver: { select: agentSelect },
      },
    });

    // Update thread timestamp
    await prisma.thread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    // Record activity for both agents
    const activityMsg = `${sourceAgent.displayName} sent message to ${targetAgent.displayName}`;
    await activityService.createActivity(req.organizationId!, {
      agentId: sourceAgent.id,
      type: 'MESSAGE',
      message: activityMsg,
      metadata: { targetAgentId: targetAgent.id, direction: 'outbound', threadId: thread.id },
    });
    await activityService.createActivity(req.organizationId!, {
      agentId: targetAgent.id,
      type: 'MESSAGE',
      message: `Received message from ${sourceAgent.displayName}`,
      metadata: { sourceAgentId: sourceAgent.id, direction: 'inbound', threadId: thread.id },
    });

    // Emit real-time events for monitoring
    const io = req.app.get('io');
    const room = `org:${req.organizationId}`;

    // Emit for Communications page (thread + message)
    io?.to(room).emit('thread:message', {
      threadId: thread.id,
      message: dbMessage,
    });

    // Emit for general activity monitoring
    io?.to(room).emit('agent:message', {
      sourceAgent: { id: sourceAgent.id, name: sourceAgent.displayName },
      targetAgent: { id: targetAgent.id, name: targetAgent.displayName },
      message,
      threadId: thread.id,
      timestamp: new Date().toISOString(),
    });

    // Record token usage if the Gateway returned usage data (fire-and-forget)
    const a2aUsage = (result as any)?.usage;
    if (resolved && a2aUsage?.inputTokens && a2aUsage?.outputTokens) {
      llmProviderService.recordTokenUsage({
        organizationId: req.organizationId!,
        agentId: targetAgent.id,
        inputTokens: a2aUsage.inputTokens,
        outputTokens: a2aUsage.outputTokens,
        model: a2aUsage.model || 'default',
        mode: resolved.mode,
      }).catch(() => {}); // fire-and-forget
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Agent Token Endpoint ──────────────────────────────

router.post('/:id/token', async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Dynamic import to avoid circular dependency
    const { generateAgentToken } = await import('./agent-api.js');
    const token = await generateAgentToken(agent.id);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Agent Integrations (Telegram, Slack, Google Chat) ──

router.get('/:id/integrations', async (req, res) => {
  try {
    const result = await integrationService.listIntegrations(req.params.id, req.organizationId!);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

router.get('/:id/integrations/:channel', async (req, res) => {
  try {
    const channel = req.params.channel.toUpperCase() as ChannelType;
    const result = await integrationService.getIntegration(req.params.id, channel, req.organizationId!);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

router.put('/:id/integrations/:channel', async (req, res) => {
  try {
    const channel = req.params.channel.toUpperCase() as ChannelType;
    const result = await integrationService.upsertIntegration(
      req.params.id,
      channel,
      req.organizationId!,
      req.body,
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch('/:id/integrations/:channel', async (req, res) => {
  try {
    const channel = req.params.channel.toUpperCase() as ChannelType;
    const { enabled } = req.body;
    const result = await integrationService.toggleIntegration(
      req.params.id,
      channel,
      req.organizationId!,
      enabled,
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/:id/integrations/:channel', async (req, res) => {
  try {
    const channel = req.params.channel.toUpperCase() as ChannelType;
    await integrationService.deleteIntegration(req.params.id, channel, req.organizationId!);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
