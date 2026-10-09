import { Router } from 'express';
import { z } from 'zod';
import * as orgService from '../services/org.service.js';
import * as inviteService from '../services/invite.service.js';
import * as boardAccessService from '../services/board-access.service.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import { encryptField } from '../lib/crypto.js';

const router = Router();

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
});

// GET / — get organization details
router.get('/', async (req, res) => {
  const org = await orgService.getOrganization(req.organizationId!);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  res.json(org);
});

// PATCH / — update organization
router.patch('/', requireRole('OWNER', 'ADMIN'), validate(updateOrgSchema), async (req, res) => {
  const org = await orgService.updateOrganization(req.organizationId!, req.body);
  res.json(org);
});

// GET /integrations — check integration status without exposing plaintext credentials
router.get('/integrations', async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const hasGithub = Boolean(settings.githubTokenEncrypted || settings.githubToken || process.env.GITHUB_TOKEN);
  const hasVercel = Boolean(settings.vercelTokenEncrypted || settings.vercelToken || process.env.VERCEL_TOKEN);
  res.json({ githubConnected: hasGithub, vercelConnected: hasVercel });
});

// POST /integrations — configure integration credentials (admin only, encrypted at rest)
router.post('/integrations', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const { githubToken, vercelToken } = req.body as { githubToken?: string; vercelToken?: string };
  const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  const current = (org.settings as Record<string, unknown>) || {};
  const updated = { ...current };

  if (typeof githubToken === 'string' && githubToken.trim()) {
    updated.githubTokenEncrypted = encryptField(githubToken.trim());
    delete updated.githubToken;
  }
  if (typeof vercelToken === 'string' && vercelToken.trim()) {
    updated.vercelTokenEncrypted = encryptField(vercelToken.trim());
    delete updated.vercelToken;
  }

  await prisma.organization.update({
    where: { id: req.organizationId! },
    data: { settings: updated as any },
  });

  res.json({
    success: true,
    githubConnected: Boolean(updated.githubTokenEncrypted),
    vercelConnected: Boolean(updated.vercelTokenEncrypted),
  });
});

// DELETE /integrations/:provider — disconnect integration credentials (admin only)
router.delete('/integrations/:provider', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const { provider } = req.params;
  const org = await prisma.organization.findUnique({ where: { id: req.organizationId! } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  const current = (org.settings as Record<string, unknown>) || {};
  const updated = { ...current };

  if (provider === 'github') {
    delete updated.githubTokenEncrypted;
    delete updated.githubToken;
  } else if (provider === 'vercel') {
    delete updated.vercelTokenEncrypted;
    delete updated.vercelToken;
  } else {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  await prisma.organization.update({
    where: { id: req.organizationId! },
    data: { settings: updated as any },
  });

  res.json({ success: true, disconnected: provider });
});

// GET /members — list members
router.get('/members', async (req, res) => {
  const members = await orgService.getMembers(req.organizationId!);
  res.json(members);
});

// POST /members/invite — invite member
router.post('/members/invite', requireRole('OWNER', 'ADMIN'), validate(inviteMemberSchema), async (req, res) => {
  try {
    const member = await orgService.inviteMember(req.organizationId!, req.body.email, req.body.role);
    res.status(201).json(member);
  } catch (e: any) {
    if (e.message === 'User is already a member of this organization') {
      return res.status(409).json({ error: e.message });
    }
    return res.status(500).json({ error: 'Failed to invite member' });
  }
});

// PATCH /members/:id — update member role
router.patch('/members/:id', requireRole('OWNER'), validate(updateMemberRoleSchema), async (req, res) => {
  try {
    const member = await orgService.updateMemberRole(req.params.id as string, req.organizationId!, req.body.role);
    res.json(member);
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

// DELETE /members/:id — remove member
router.delete('/members/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await orgService.removeMember(req.params.id as string, req.organizationId!);
    res.status(204).end();
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

// GET /members/:id — get single member with board access
router.get('/members/:id', async (req, res) => {
  try {
    const member = await boardAccessService.getMemberWithAccess(req.params.id as string, req.organizationId!);
    res.json(member);
  } catch (e: any) {
    return res.status(e.statusCode || 404).json({ error: e.message });
  }
});

// PUT /members/:id/access — update member board access
router.put('/members/:id/access', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const member = await boardAccessService.updateMemberAccess(
      req.params.id as string,
      req.organizationId!,
      {
        allBoardsRead: req.body.allBoardsRead ?? false,
        allBoardsWrite: req.body.allBoardsWrite ?? false,
        boardAccess: req.body.boardAccess ?? [],
      },
    );
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('member:accessUpdated', member);
    res.json(member);
  } catch (e: any) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// GET /api-keys — list API keys
router.get('/api-keys', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const keys = await orgService.getApiKeys(req.organizationId!);
  res.json(keys);
});

// POST /api-keys — create API key
router.post('/api-keys', requireRole('OWNER', 'ADMIN'), validate(createApiKeySchema), async (req, res) => {
  const key = await orgService.createApiKey(req.organizationId!, req.body.name);
  res.status(201).json(key);
});

// DELETE /api-keys/:id — revoke API key
router.delete('/api-keys/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await orgService.revokeApiKey(req.params.id as string, req.organizationId!);
    res.status(204).end();
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

// ─── Invitations ─────────────────────────────────────────
router.get('/invites', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const invites = await inviteService.listInvites(req.organizationId!);
  res.json(invites);
});

router.post('/invites', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const invite = await inviteService.createInvite(req.organizationId!, {
      ...req.body,
      createdByUserId: req.user?.id,
    });
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('invite:created', invite);
    res.status(201).json(invite);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'An invite for this email already exists' });
    }
    return res.status(500).json({ error: 'Failed to create invite' });
  }
});

router.delete('/invites/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  await inviteService.revokeInvite(req.params.id as string, req.organizationId!);
  res.status(204).end();
});

router.post('/invites/:token/accept', async (req, res) => {
  try {
    const member = await inviteService.acceptInvite(req.params.token as string, req.user!.id);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('invite:accepted', member);
    res.json(member);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

export default router;
