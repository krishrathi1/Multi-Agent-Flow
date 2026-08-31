import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../lib/jwt.js';
import { generateApiKey, hashApiKey } from '../lib/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/api-key-auth.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import { createTestUser, cleanupTestData } from './setup.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = express();
  app.use(express.json());
  return app;
}

function listenOnRandomPort(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
      }
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// 1. JWT Tests
// ---------------------------------------------------------------------------

describe('JWT utilities', () => {
  const payload: TokenPayload = { userId: 'user-123', email: 'jwt@test.local' };

  it('signAccessToken produces a valid JWT', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    // A JWT has three dot-separated parts
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('verifyAccessToken decodes correctly', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('verifyAccessToken rejects an invalid token', () => {
    expect(() => verifyAccessToken('not.a.valid.token')).toThrow();
  });

  it('signRefreshToken produces a valid JWT', () => {
    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('verifyRefreshToken decodes correctly', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('verifyRefreshToken rejects an invalid token', () => {
    expect(() => verifyRefreshToken('garbage-token')).toThrow();
  });

  it('access token and refresh token use different secrets (cross-verification fails)', () => {
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Verifying an access token as a refresh token should throw
    expect(() => verifyRefreshToken(accessToken)).toThrow();

    // Verifying a refresh token as an access token should throw
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. requireAuth Middleware Tests
// ---------------------------------------------------------------------------

describe('requireAuth middleware', () => {
  let server: Server;
  let baseUrl: string;
  let testData: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testData = await createTestUser('auth-mw');

    const app = createTestApp();
    app.get('/protected', requireAuth, (req, res) => {
      res.json({
        userId: req.user?.id,
        email: req.user?.email,
        name: req.user?.name,
        organizationId: req.organizationId,
        orgRole: req.orgRole,
      });
    });

    const result = await listenOnRandomPort(app);
    server = result.server;
    baseUrl = result.baseUrl;
  });

  afterAll(async () => {
    await closeServer(server);
    await cleanupTestData(testData.organization.id);
  });

  it('rejects request with no Authorization header (401)', async () => {
    const res = await fetch(`${baseUrl}/protected`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('No token provided');
  });

  it('rejects request with invalid token (401)', async () => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: 'Bearer invalid-token-value' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired token');
  });

  it('rejects request with expired token (401)', async () => {
    // Create a token that expired 1 hour ago
    const secret = process.env.JWT_SECRET || 'nexus-access-secret-dev';
    const expiredToken = jwt.sign(
      { userId: testData.user.id, email: testData.user.email },
      secret,
      { expiresIn: '-1h' },
    );
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired token');
  });

  it('rejects request for user with no org membership (403)', async () => {
    // Create a user directly in the DB without any org membership
    const orphanUser = await prisma.user.create({
      data: {
        email: `orphan-${Date.now()}@nexus-test.local`,
        password: 'hashed',
        name: 'Orphan User',
      },
    });
    const token = signAccessToken({ userId: orphanUser.id, email: orphanUser.email });

    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('No organization membership');

    // Clean up the orphan user
    await prisma.user.delete({ where: { id: orphanUser.id } });
  });

  it('passes request with valid token, sets req.user/organizationId/orgRole', async () => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${testData.accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(testData.user.id);
    expect(body.email).toBe(testData.user.email);
    expect(body.organizationId).toBe(testData.organization.id);
    expect(body.orgRole).toBe('OWNER');
  });
});

// ---------------------------------------------------------------------------
// 3. requireRole Middleware Tests
// ---------------------------------------------------------------------------

describe('requireRole middleware', () => {
  let server: Server;
  let baseUrl: string;
  let ownerData: Awaited<ReturnType<typeof createTestUser>>;
  let viewerToken: string;

  beforeAll(async () => {
    ownerData = await createTestUser('role-mw');

    // Create a VIEWER member in the same org
    const viewerUser = await prisma.user.create({
      data: {
        email: `viewer-${Date.now()}@nexus-test.local`,
        password: 'hashed',
        name: 'Viewer User',
      },
    });
    await prisma.orgMember.create({
      data: {
        organizationId: ownerData.organization.id,
        userId: viewerUser.id,
        role: 'VIEWER',
      },
    });
    viewerToken = signAccessToken({ userId: viewerUser.id, email: viewerUser.email });

    const app = createTestApp();

    // Route that requires OWNER or ADMIN
    app.get('/admin-only', requireAuth, requireRole('OWNER', 'ADMIN'), (_req, res) => {
      res.json({ ok: true });
    });

    // Route that requires only OWNER
    app.get('/owner-only', requireAuth, requireRole('OWNER'), (_req, res) => {
      res.json({ ok: true });
    });

    const result = await listenOnRandomPort(app);
    server = result.server;
    baseUrl = result.baseUrl;
  });

  afterAll(async () => {
    await closeServer(server);
    await cleanupTestData(ownerData.organization.id);
  });

  it('allows request when user has required role', async () => {
    const res = await fetch(`${baseUrl}/owner-only`, {
      headers: { Authorization: `Bearer ${ownerData.accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('rejects request when user lacks required role (403)', async () => {
    const res = await fetch(`${baseUrl}/owner-only`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Insufficient permissions');
  });

  it('supports multiple allowed roles', async () => {
    // OWNER should pass the OWNER|ADMIN check
    const res = await fetch(`${baseUrl}/admin-only`, {
      headers: { Authorization: `Bearer ${ownerData.accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // VIEWER should still fail the OWNER|ADMIN check
    const res2 = await fetch(`${baseUrl}/admin-only`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    expect(res2.status).toBe(403);
    const body2 = await res2.json();
    expect(body2.error).toBe('Insufficient permissions');
  });
});

// ---------------------------------------------------------------------------
// 4. API Key Auth Tests
// ---------------------------------------------------------------------------

describe('requireApiKey middleware', () => {
  let server: Server;
  let baseUrl: string;
  let testData: Awaited<ReturnType<typeof createTestUser>>;
  let validApiKey: string;

  beforeAll(async () => {
    testData = await createTestUser('apikey-mw');

    // Generate and store a valid API key
    const { key, prefix, hash } = generateApiKey();
    validApiKey = key;
    await prisma.orgApiKey.create({
      data: {
        organizationId: testData.organization.id,
        name: 'Test Key',
        keyHash: hash,
        keyPrefix: prefix,
      },
    });

    const app = createTestApp();
    app.get('/api-protected', requireApiKey, (req, res) => {
      res.json({ organizationId: req.organizationId });
    });

    const result = await listenOnRandomPort(app);
    server = result.server;
    baseUrl = result.baseUrl;
  });

  afterAll(async () => {
    await closeServer(server);
    await cleanupTestData(testData.organization.id);
  });

  it('rejects request with no X-API-Key header (401)', async () => {
    const res = await fetch(`${baseUrl}/api-protected`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('API key required');
  });

  it('rejects request with invalid API key (401)', async () => {
    const res = await fetch(`${baseUrl}/api-protected`, {
      headers: { 'X-API-Key': 'nxk_this_is_not_a_real_key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid API key');
  });

  it('passes request with valid API key, sets req.organizationId', async () => {
    const res = await fetch(`${baseUrl}/api-protected`, {
      headers: { 'X-API-Key': validApiKey },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organizationId).toBe(testData.organization.id);
  });

  it('rejects expired API key (401)', async () => {
    // Create an API key that is already expired
    const { key: expiredKey, prefix: expiredPrefix, hash: expiredHash } = generateApiKey();
    await prisma.orgApiKey.create({
      data: {
        organizationId: testData.organization.id,
        name: 'Expired Key',
        keyHash: expiredHash,
        keyPrefix: expiredPrefix,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired 1 day ago
      },
    });

    const res = await fetch(`${baseUrl}/api-protected`, {
      headers: { 'X-API-Key': expiredKey },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('API key expired');
  });
});

// ---------------------------------------------------------------------------
// 5. Validation Middleware Tests
// ---------------------------------------------------------------------------

describe('validate middleware', () => {
  let server: Server;
  let baseUrl: string;

  const testSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    age: z.number().int().positive().optional(),
  });

  beforeAll(async () => {
    const app = createTestApp();
    app.post('/validated', validate(testSchema), (req, res) => {
      res.json({ received: req.body });
    });

    const result = await listenOnRandomPort(app);
    server = result.server;
    baseUrl = result.baseUrl;
  });

  afterAll(async () => {
    await closeServer(server);
  });

  it('passes valid request body', async () => {
    const res = await fetch(`${baseUrl}/validated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received.name).toBe('Alice');
    expect(body.received.email).toBe('alice@example.com');
  });

  it('rejects invalid body with 400 and error details', async () => {
    const res = await fetch(`${baseUrl}/validated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
  });

  it('validates email format', async () => {
    const res = await fetch(`${baseUrl}/validated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    // Find the email validation error in the details
    const emailError = body.details.find(
      (d: { path: string[] }) => d.path.includes('email'),
    );
    expect(emailError).toBeDefined();
  });

  it('validates minimum string length', async () => {
    const res = await fetch(`${baseUrl}/validated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AB', email: 'valid@example.com' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    const nameError = body.details.find(
      (d: { path: string[] }) => d.path.includes('name'),
    );
    expect(nameError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Crypto Utils Tests
// ---------------------------------------------------------------------------

describe('Crypto utilities', () => {
  it('generateApiKey returns key, prefix, and hash', () => {
    const result = generateApiKey();
    expect(typeof result.key).toBe('string');
    expect(typeof result.prefix).toBe('string');
    expect(typeof result.hash).toBe('string');
    // Key should start with the nxk_ prefix
    expect(result.key.startsWith('nxk_')).toBe(true);
    // All three should be non-empty
    expect(result.key.length).toBeGreaterThan(0);
    expect(result.prefix.length).toBeGreaterThan(0);
    expect(result.hash.length).toBeGreaterThan(0);
  });

  it('hashApiKey produces consistent hashes', () => {
    const key = 'nxk_test-key-for-consistency';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it('hashApiKey produces different hashes for different keys', () => {
    const hash1 = hashApiKey('nxk_key-one');
    const hash2 = hashApiKey('nxk_key-two');
    expect(hash1).not.toBe(hash2);
  });

  it('generated key prefix matches first chars of key', () => {
    const result = generateApiKey();
    // The prefix is the first 12 characters of the key
    expect(result.prefix).toBe(result.key.substring(0, 12));
  });
});
