import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// WebSocket rate limiting per client
const WS_RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const WS_RATE_LIMIT_MAX = 50; // max 50 events per window
const wsRateMap = new Map<string, { count: number; resetAt: number }>();

function checkWsRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = wsRateMap.get(socketId);
  if (!entry || now > entry.resetAt) {
    wsRateMap.set(socketId, { count: 1, resetAt: now + WS_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= WS_RATE_LIMIT_MAX;
}

// CORS: env-based origin configuration for WebSocket
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection limits
    maxHttpBufferSize: 1e6, // 1MB max message size
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // JWT authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      const member = await prisma.orgMember.findFirst({ where: { userId: payload.userId } });
      if (!member) return next(new Error('No organization'));
      socket.data.userId = payload.userId;
      socket.data.organizationId = member.organizationId;
      socket.join(`org:${member.organizationId}`);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, orgId: socket.data.organizationId }, 'Client connected');

    // Rate-limit incoming events from clients
    socket.use((event, next) => {
      if (!checkWsRateLimit(socket.id)) {
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });

    socket.on('disconnect', () => {
      wsRateMap.delete(socket.id);
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  // Cleanup stale rate limit entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of wsRateMap) {
      if (now > entry.resetAt) wsRateMap.delete(key);
    }
  }, 60_000);

  return io;
}
