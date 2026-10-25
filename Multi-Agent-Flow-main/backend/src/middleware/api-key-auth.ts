import { Request, Response, NextFunction } from 'express';
import { hashApiKey } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });

  try {
    const keyHash = hashApiKey(apiKey);
    const orgKey = await prisma.orgApiKey.findUnique({ where: { keyHash } });
    if (!orgKey) return res.status(401).json({ error: 'Invalid API key' });

    // Check expiry
    if (orgKey.expiresAt && orgKey.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    // Update lastUsedAt
    await prisma.orgApiKey.update({ where: { id: orgKey.id }, data: { lastUsedAt: new Date() } });

    req.organizationId = orgKey.organizationId;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
