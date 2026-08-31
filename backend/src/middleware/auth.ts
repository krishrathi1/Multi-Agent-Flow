import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { OrgRole } from '@prisma/client';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = verifyAccessToken(header.slice(7));
    const member = await prisma.orgMember.findFirst({
      where: { userId: payload.userId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!member) return res.status(403).json({ error: 'No organization membership' });

    req.user = member.user;
    req.organizationId = member.organizationId;
    req.orgRole = member.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.orgRole || !roles.includes(req.orgRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
