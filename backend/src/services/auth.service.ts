import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { createHash, randomBytes } from 'crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import { sendVerificationEmail } from '../lib/email.js';
import { ensureDefaultGateway } from './gateway.service.js';
import { populateOrgDefaults } from './org-defaults.service.js';

const tracer = trace.getTracer('nexus-auth');

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export async function signup(data: {
  email: string;
  password: string;
  name: string;
  orgName: string;
}) {
  return tracer.startActiveSpan('auth.signup', async (span) => {
    try {
      span.setAttribute('auth.email', data.email);
      span.setAttribute('auth.orgName', data.orgName);

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Email already in use' });
    throw new Error('Email already in use');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // Create user, org, membership, and verification token in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        emailVerified: false,
      },
    });

    const slug = toSlug(data.orgName);
    // Ensure slug uniqueness by appending random suffix if needed
    let finalSlug = slug;
    const existingOrg = await tx.organization.findUnique({ where: { slug } });
    if (existingOrg) {
      finalSlug = `${slug}-${randomBytes(3).toString('hex')}`;
    }

    const organization = await tx.organization.create({
      data: {
        name: data.orgName,
        slug: finalSlug,
      },
    });

    await tx.orgMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    // Create email verification token (24h expiry)
    const verificationToken = generateVerificationToken();
    await tx.emailVerification.create({
      data: {
        userId: user.id,
        token: hashToken(verificationToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      verificationToken,
    };
  });

  // Send verification email (outside transaction — non-blocking to DB)
  await sendVerificationEmail(data.email, result.verificationToken);

  // Auto-provision default gateway if configured (fire-and-forget)
  ensureDefaultGateway(result.organization.id).catch(err =>
    logger.warn({ orgId: result.organization.id, err }, 'Gateway auto-provision failed during signup')
  );

  // Populate default soul templates and marketplace skills (fire-and-forget)
  populateOrgDefaults(result.organization.id).catch(err =>
    logger.warn({ orgId: result.organization.id, err }, 'Org defaults population failed during signup')
  );

  span.setAttribute('auth.userId', result.user.id);
  span.setAttribute('auth.orgId', result.organization.id);
  logger.info({ userId: result.user.id, orgId: result.organization.id }, 'User signed up — verification email sent');

  return {
    user: result.user,
    organization: result.organization,
    requiresVerification: true,
  };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function verifyEmail(token: string) {
  return tracer.startActiveSpan('auth.verifyEmail', async (span) => {
    try {
      const hashedToken = hashToken(token);

      const verification = await prisma.emailVerification.findUnique({
        where: { token: hashedToken },
        include: { user: true },
      });

      if (!verification) {
        throw new Error('Invalid verification token');
      }

      if (verification.expiresAt < new Date()) {
        // Clean up expired token
        await prisma.emailVerification.delete({ where: { id: verification.id } });
        throw new Error('Verification token has expired');
      }

      if (verification.user.emailVerified) {
        // Already verified — clean up token and return success
        await prisma.emailVerification.deleteMany({ where: { userId: verification.userId } });
        return { message: 'Email already verified' };
      }

      // Mark user as verified and clean up all verification tokens for this user
      await prisma.$transaction([
        prisma.user.update({
          where: { id: verification.userId },
          data: { emailVerified: true },
        }),
        prisma.emailVerification.deleteMany({
          where: { userId: verification.userId },
        }),
      ]);

      span.setAttribute('auth.userId', verification.userId);
      logger.info({ userId: verification.userId }, 'Email verified');

      return { message: 'Email verified successfully' };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function resendVerification(email: string) {
  return tracer.startActiveSpan('auth.resendVerification', async (span) => {
    try {
      span.setAttribute('auth.email', email);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Don't reveal whether the email exists
        return { message: 'If the email is registered, a verification link has been sent' };
      }

      if (user.emailVerified) {
        return { message: 'Email is already verified' };
      }

      // Delete any existing verification tokens for this user
      await prisma.emailVerification.deleteMany({ where: { userId: user.id } });

      // Create new verification token
      const verificationToken = generateVerificationToken();
      await prisma.emailVerification.create({
        data: {
          userId: user.id,
          token: hashToken(verificationToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await sendVerificationEmail(email, verificationToken);

      logger.info({ userId: user.id }, 'Verification email resent');
      return { message: 'If the email is registered, a verification link has been sent' };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function login(data: { email: string; password: string }) {
  return tracer.startActiveSpan('auth.login', async (span) => {
    try {
      span.setAttribute('auth.email', data.email);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid credentials' });
    logger.warn({ email: data.email }, 'Login failed: user not found');
    throw new Error('Invalid email or password');
  }

  const validPassword = await bcrypt.compare(data.password, user.password);
  if (!validPassword) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid credentials' });
    logger.warn({ email: data.email }, 'Login failed: wrong password');
    throw new Error('Invalid email or password');
  }

  // Block login if email is not verified
  if (!user.emailVerified) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'Email not verified' });
    logger.warn({ email: data.email }, 'Login failed: email not verified');
    throw new Error('Email not verified');
  }

  // Find their org membership
  const member = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });
  if (!member) {
    throw new Error('No organization membership found');
  }

  // Generate tokens
  const tokenPayload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Delete existing refresh tokens for this user (token rotation)
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  // Store hashed refresh token
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  span.setAttribute('auth.userId', user.id);
  span.setAttribute('auth.orgId', member.organization.id);
  logger.info({ userId: user.id, orgId: member.organization.id }, 'User logged in');
  return {
    user: { id: user.id, email: user.email, name: user.name },
    organization: member.organization,
    accessToken,
    refreshToken,
  };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function refresh(refreshTokenValue: string) {
  return tracer.startActiveSpan('auth.refresh', async (span) => {
    try {
  // Verify the JWT
  const payload = verifyRefreshToken(refreshTokenValue);
  span.setAttribute('auth.userId', payload.userId);

  // Find the stored token
  const hashedToken = hashToken(refreshTokenValue);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: hashedToken },
  });
  if (!storedToken) {
    throw new Error('Refresh token not found or already used');
  }

  // Check expiration
  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new Error('Refresh token expired');
  }

  // Verify user still exists (prevents stale tokens after DB wipe/migration)
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    throw new Error('User no longer exists');
  }

  // Delete old token (rotate)
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Generate new pair
  const tokenPayload = { userId: user.id, email: user.email };
  const newAccessToken = signAccessToken(tokenPayload);
  const newRefreshToken = signRefreshToken(tokenPayload);

  // Store new refresh token
  await prisma.refreshToken.create({
    data: {
      userId: payload.userId,
      token: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info({ userId: payload.userId }, 'Token refreshed');
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function logout(refreshTokenValue: string) {
  return tracer.startActiveSpan('auth.logout', async (span) => {
    try {
  const hashedToken = hashToken(refreshTokenValue);
  await prisma.refreshToken.deleteMany({
    where: { token: hashedToken },
  });
  logger.info('User logged out');
    } finally {
      span.end();
    }
  });
}

export async function getMe(userId: string) {
  return tracer.startActiveSpan('auth.getMe', async (span) => {
    try {
      span.setAttribute('auth.userId', userId);
  const member = await prisma.orgMember.findFirst({
    where: { userId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!member) {
    throw new Error('No organization membership found');
  }

  return {
    user: member.user,
    organization: member.organization,
    role: member.role,
  };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
