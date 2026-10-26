import type { Response } from 'express';

/**
 * Maps a thrown error to an HTTP status and a client-safe message.
 *
 * Routes used to answer `res.status(500).json({ error: err.message })`, which
 * turned every "Gateway not found" into a 500 and shipped Prisma's full
 * invocation dump — table names, column values, the query shape — to the
 * browser. Prisma errors are now reduced to a generic message, and the
 * common cases get the status a client can act on.
 */
export function describeError(err: unknown, fallbackStatus = 500): { status: number; message: string } {
  const e = err as { name?: string; code?: string; message?: string; statusCode?: number; status?: number; meta?: any } | undefined;
  const message = typeof e?.message === 'string' ? e.message : '';
  const isPrisma = typeof e?.name === 'string' && e.name.startsWith('PrismaClient');

  if (isPrisma) {
    switch (e?.code) {
      case 'P2002': {
        const target = e.meta?.target;
        return { status: 409, message: `Already exists${Array.isArray(target) ? `: ${target.join(', ')}` : ''}` };
      }
      case 'P2003': return { status: 400, message: 'Referenced record does not exist' };
      case 'P2023': return { status: 400, message: 'Invalid id' };
      case 'P2025': return { status: 404, message: 'Record not found' };
    }
    if (e?.name === 'PrismaClientValidationError') return { status: 400, message: 'Invalid request data' };
    return { status: 500, message: 'Internal server error' };
  }

  const explicit = e?.statusCode ?? e?.status;
  if (typeof explicit === 'number' && explicit >= 400 && explicit < 600) {
    return { status: explicit, message: message || 'Request failed' };
  }
  if (/\bnot found\b/i.test(message)) return { status: 404, message };
  return { status: fallbackStatus, message: message || 'Internal server error' };
}

export function sendError(res: Response, err: unknown, fallbackStatus = 500) {
  const { status, message } = describeError(err, fallbackStatus);
  return res.status(status).json({ error: message });
}
