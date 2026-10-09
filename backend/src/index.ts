import 'dotenv/config';
import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { createServer } from 'http';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { setupWebSocket } from './websocket/index.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import orgRoutes from './routes/organizations.js';
import agentRoutes from './routes/agents.js';
import activityRoutes from './routes/activities.js';
import taskRoutes from './routes/tasks.js';
import threadRoutes from './routes/threads.js';
import sessionRoutes from './routes/sessions.js';
import metricsRoutes from './routes/metrics.js';
import alertRoutes from './routes/alerts.js';
import commandRoutes from './routes/commands.js';
import searchRoutes from './routes/search.js';
import configRoutes from './routes/config.js';
import mcpRoutes, { orgMcpRouter } from './routes/mcp.js';
import remoteRoutes from './routes/remote.js';
import { requireApiKey } from './middleware/api-key-auth.js';
import gatewayRoutes from './routes/gateways.js';
import llmProviderRoutes from './routes/llm-providers.js';
import opencodeRoutes from './routes/opencode.js';
import boardRoutes from './routes/boards.js';
import approvalRoutes from './routes/approvals.js';
import agentApiRoutes from './routes/agent-api.js';
import tagRoutes from './routes/tags.js';
import customFieldRoutes from './routes/custom-fields.js';
import skillRoutes from './routes/skills.js';
import webhookRoutes from './routes/webhooks.js';
import webhookInboundRoutes from './routes/webhook-inbound.js';
import onboardingRoutes from './routes/onboarding.js';
import boardGroupMemoryRoutes from './routes/board-group-memory.js';
import boardMemoryRoutes from './routes/board-memory.js';
import soulTemplateRoutes from './routes/soul-templates.js';
import processRoutes from './routes/processes.js';
import previewRoutes from './routes/preview.js';
import processExtrasRoutes from './routes/process-extras.js';
import codeIntelligenceRoutes from './routes/code-intelligence.js';
import promptRoutes from './routes/prompts.js';
import gitWebhookRoutes from './routes/git-webhook.js';
import incidentRoutes from './routes/incidents.js';
import { startScheduler } from './services/scheduler.js';
import { startGitWatcher } from './services/git-watcher.service.js';
import { recoverOrphanedRuns } from './services/agent-runner.service.js';
import { connectAllGateways, setSocketIO } from './services/gateway.service.js';

const app = express();
const httpServer = createServer(app);
const PORT = config.port;

// Trust first proxy (nginx/Cloudflare) — required for correct rate limiting & secure cookies
app.set('trust proxy', 1);

// CORS: env-based origin configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : config.corsOrigins;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by frontend
  crossOriginEmbedderPolicy: false, // Needed for WebSocket
}));
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-Token', 'X-Api-Key', 'X-Organization-Id', 'X-Webhook-Secret', 'X-Hub-Signature-256'],
}));

// Cookie parser (for httpOnly refresh token cookies)
app.use(cookieParser());

// Structured HTTP request logging (pino)
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health', // skip health checks
  },
}));

// Request size limits & raw buffer capture for webhook HMAC validation
app.use(express.json({
  limit: '1mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Disable X-Powered-By (helmet does this, but explicit for clarity)
app.disable('x-powered-by');

// Health check (public liveness)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check (public non-leaking probe for Docker / K8s)
app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', error: 'Database service unavailable' });
  }
});

// Diagnostics cache to prevent excessive provider probing
let cachedDiagnostics: { data: any; expiresAt: number } | null = null;

// System Deep Diagnostics (Protected — operators & authenticated admins only)
app.get('/api/system/diagnostics', requireAuth, requireRole('OWNER', 'ADMIN'), async (_req, res) => {
  const now = Date.now();
  if (cachedDiagnostics && now < cachedDiagnostics.expiresAt) {
    return res.json(cachedDiagnostics.data);
  }

  const start = Date.now();
  let dbStatus = 'DOWN';
  let dbLatencyMs = -1;
  try {
    const t0 = Date.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    dbLatencyMs = Date.now() - t0;
    dbStatus = 'UP';
  } catch {
    dbStatus = 'DOWN';
  }

  let geminiStatus = 'UNKNOWN';
  let geminiLatencyMs = -1;
  const geminiKey = process.env.GEMINI_API_KEY;
  try {
    if (geminiKey) {
      const t0 = Date.now();
      const resp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        {
          headers: { 'x-goog-api-key': geminiKey },
          signal: AbortSignal.timeout(4000),
        }
      );
      geminiLatencyMs = Date.now() - t0;
      geminiStatus = resp.ok ? 'UP' : 'DEGRADED';
    } else {
      geminiStatus = 'NOT_CONFIGURED';
    }
  } catch {
    geminiStatus = 'TIMEOUT';
  }

  let opencodeStatus: any = { installed: false, version: 'N/A' };
  try {
    const { status: getOcStatus } = await import('./services/opencode.service.js');
    opencodeStatus = await getOcStatus();
  } catch {
    /* ignore */
  }

  const mem = process.memoryUsage();
  const isHealthy = dbStatus === 'UP';

  const payload = {
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    durationMs: Date.now() - start,
    checks: {
      database: { status: dbStatus, latencyMs: dbLatencyMs, type: 'PostgreSQL' },
      gemini: { status: geminiStatus, latencyMs: geminiLatencyMs, activeModel: config.geminiModel },
      opencode: { status: opencodeStatus.installed ? 'UP' : 'ABSENT', ...opencodeStatus },
      socketIo: { status: 'UP' },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
    },
  };

  cachedDiagnostics = { data: payload, expiresAt: Date.now() + 15_000 };
  res.status(isHealthy ? 200 : 503).json(payload);
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/agents', requireAuth, agentRoutes);
app.use('/api/activities', requireAuth, activityRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/threads', requireAuth, threadRoutes);
app.use('/api/sessions', requireAuth, sessionRoutes);
app.use('/api/tokens', requireAuth, metricsRoutes);    // token routes at /api/tokens
app.use('/api/metrics', requireAuth, metricsRoutes);   // metric routes at /api/metrics
app.use('/api/alerts', requireAuth, alertRoutes);
app.use('/api/commands', requireAuth, commandRoutes);
app.use('/api/activities/search', requireAuth, searchRoutes);
app.use('/api/agents', requireAuth, configRoutes);
app.use('/api/org', requireAuth, orgRoutes);

// MCP routes (nested under agents, needs mergeParams in router)
app.use('/api/agents/:agentId/mcp-servers', requireAuth, mcpRoutes);
app.use('/api/mcp', requireAuth, orgMcpRouter);

// Remote agent routes (API key auth, not JWT)
app.use('/api/remote', requireApiKey, remoteRoutes);

// Gateway routes
app.use('/api/gateways', requireAuth, gatewayRoutes);

// LLM Provider routes
app.use('/api/llm-providers', requireAuth, llmProviderRoutes);
app.use('/api/opencode', requireAuth, opencodeRoutes);

// Board routes (boards + board groups)
app.use('/api/boards', requireAuth, boardRoutes);

// Approval routes
app.use('/api/approvals', requireAuth, approvalRoutes);

// Agent self-auth API (agents authenticate with X-Agent-Token, no JWT needed)
app.use('/api/agent-api', agentApiRoutes);

// Mission Control features
app.use('/api/tags', requireAuth, tagRoutes);
app.use('/api/custom-fields', requireAuth, customFieldRoutes);
app.use('/api/skills', requireAuth, skillRoutes);
app.use('/api/boards', requireAuth, webhookRoutes);
app.use('/api/v1/webhooks', webhookInboundRoutes);  // PUBLIC - no auth
app.use('/api/webhooks/git-push', gitWebhookRoutes); // PUBLIC - no auth (called by git hooks & webhooks)
app.use('/api/v1/git-webhook', gitWebhookRoutes);    // PUBLIC - no auth
app.use('/api/boards', requireAuth, onboardingRoutes);
app.use('/api/board-groups', requireAuth, boardGroupMemoryRoutes);
app.use('/api/boards', requireAuth, boardMemoryRoutes);
app.use('/api/soul-templates', requireAuth, soulTemplateRoutes);

// Production chains (processes)
app.use('/api/processes', requireAuth, processRoutes);

// Run history, templates, schedules and webhooks for production chains.
app.use('/api/orchestration', requireAuth, processExtrasRoutes);

// Read-only preview of what production chains build. Unauthenticated so a
// generated site can be opened directly; scoped to one workspace per chain.
app.use('/preview', previewRoutes);

// Code Intelligence (semantic search, symbol explorer, dependency graph)
app.use('/api/code-intelligence', requireAuth, codeIntelligenceRoutes);

// Prompt Engineering (template registry + playground)
app.use('/api/prompts', requireAuth, promptRoutes);

// Autonomous DevOps Incident Investigation Agent & Doctor
app.use('/api/incidents', requireAuth, incidentRoutes);

// Global error handler for unhandled async errors in routes
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Body-parser rejects unparseable JSON — that's the caller's mistake, not ours.
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  // Payload larger than the configured limit.
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  // Prisma unique constraint violation
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: `Unique constraint failed on: ${err.meta?.target?.join(', ') || 'unknown field'}` });
  }
  // Prisma foreign key constraint violation
  if (err?.code === 'P2003') {
    return res.status(400).json({ error: `Foreign key constraint violated: ${err.meta?.field_name || 'unknown'}` });
  }
  // Prisma record not found
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  logger.error({ err }, 'Unhandled route error');
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// WebSocket
const io = setupWebSocket(httpServer);
app.set('io', io);

// Share Socket.io with gateway service for event forwarding
setSocketIO(io);

// Reset any agents stuck as ONLINE from a previous crash (no agent can be
// actively processing when the server just started)
prisma.agent.updateMany({
  where: { status: 'ONLINE' },
  data: { status: 'IDLE' },
}).then(({ count }) => {
  if (count > 0) logger.info({ count }, 'Reset stuck ONLINE agents to IDLE on startup');
}).catch(() => {});

// Connect to all gateways on startup
connectAllGateways().catch(err => {
  logger.warn({ err }, 'Gateway connection errors on startup');
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Nexus backend running');
  // A restart can strand runs mid-flight; clean them up before scheduling more.
  void recoverOrphanedRuns().catch((err) =>
    logger.error({ err }, 'Failed to recover orphaned runs'),
  );
  // Cron tick for scheduled production-chain runs.
  startScheduler(io);
  // Automatic Git Watcher for auto-review on commit/push
  startGitWatcher(io);
});
