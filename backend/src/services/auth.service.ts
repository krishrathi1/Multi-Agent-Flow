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

/** How long a rotated refresh token keeps working (see refresh()). */
const REFRESH_REUSE_GRACE_MS = 60_000;

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

function generateOtp(): string {
  // Generate a random 6-digit number string
  return Math.floor(100000 + Math.random() * 900000).toString();
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

        // Create email verification token & 6-digit OTP (24h expiry)
        const verificationToken = generateVerificationToken();
        const otp = generateOtp();
        await tx.emailVerification.create({
          data: {
            userId: user.id,
            token: hashToken(verificationToken),
            otp,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        return {
          user: { id: user.id, email: user.email, name: user.name },
          organization: { id: organization.id, name: organization.name, slug: organization.slug },
          verificationToken,
          otp,
        };
      });

      // Send verification email (outside transaction — non-blocking to DB)
      try {
        await sendVerificationEmail(data.email, result.verificationToken, result.otp);
      } catch (emailErr) {
        logger.warn({ email: data.email, err: emailErr }, 'Verification email failed, user created with OTP');
      }

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
      logger.info({ userId: result.user.id, orgId: result.organization.id, otp: result.otp }, 'User signed up — verification email & OTP sent');

      return {
        user: result.user,
        organization: result.organization,
        requiresVerification: true,
        otp: result.otp,
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
        await prisma.emailVerification.delete({ where: { id: verification.id } });
        throw new Error('Verification token has expired');
      }

      if (verification.user.emailVerified) {
        await prisma.emailVerification.deleteMany({ where: { userId: verification.userId } });
        return { message: 'Email already verified' };
      }

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

export async function verifyOtp(email: string, otp: string) {
  return tracer.startActiveSpan('auth.verifyOtp', async (span) => {
    try {
      span.setAttribute('auth.email', email);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error('Invalid verification code');
      }

      if (user.emailVerified) {
        await prisma.emailVerification.deleteMany({ where: { userId: user.id } });
        return { message: 'Email already verified' };
      }

      const verification = await prisma.emailVerification.findFirst({
        where: {
          userId: user.id,
          otp: otp.trim(),
        },
      });

      if (!verification) {
        throw new Error('Invalid verification code');
      }

      if (verification.expiresAt < new Date()) {
        await prisma.emailVerification.delete({ where: { id: verification.id } });
        throw new Error('Verification code has expired');
      }

      // Mark user as verified and delete all verification records
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        }),
        prisma.emailVerification.deleteMany({
          where: { userId: user.id },
        }),
      ]);

      span.setAttribute('auth.userId', user.id);
      logger.info({ userId: user.id, email }, 'Email verified via OTP');

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
        return { message: 'If the email is registered, a verification code has been sent' };
      }

      if (user.emailVerified) {
        return { message: 'Email is already verified' };
      }

      await prisma.emailVerification.deleteMany({ where: { userId: user.id } });

      const verificationToken = generateVerificationToken();
      const otp = generateOtp();
      await prisma.emailVerification.create({
        data: {
          userId: user.id,
          token: hashToken(verificationToken),
          otp,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await sendVerificationEmail(email, verificationToken, otp);

      logger.info({ userId: user.id, otp }, 'Verification email & OTP resent');
      return { message: 'If the email is registered, a verification code has been sent', otp };
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
        role: member.role,
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
      const payload = verifyRefreshToken(refreshTokenValue);
      span.setAttribute('auth.userId', payload.userId);

      const hashedToken = hashToken(refreshTokenValue);
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: hashedToken },
      });
      if (!storedToken) {
        throw new Error('Refresh token not found or already used');
      }

      if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new Error('Refresh token expired');
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new Error('User no longer exists');
      }

      // Rotate with a short grace window instead of deleting outright. A
      // browser that navigates while a refresh is in flight never receives
      // the new cookie, and parallel refreshes all present the same one; with
      // immediate deletion either case logged the user out (reloading a page
      // twice was enough). The old token stops working after the window.
      const graceEnds = new Date(Date.now() + REFRESH_REUSE_GRACE_MS);
      if (storedToken.expiresAt > graceEnds) {
        await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { expiresAt: graceEnds } });
      }

      const tokenPayload = { userId: user.id, email: user.email };
      const newAccessToken = signAccessToken(tokenPayload);
      const newRefreshToken = signRefreshToken(tokenPayload);

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

export async function getMe(userId: string, organizationId?: string) {
  return tracer.startActiveSpan('auth.getMe', async (span) => {
    try {
      span.setAttribute('auth.userId', userId);
      let member = null;
      if (organizationId) {
        member = await prisma.orgMember.findFirst({
          where: { userId, organizationId },
          include: {
            user: { select: { id: true, email: true, name: true } },
            organization: { select: { id: true, name: true, slug: true } },
          },
        });
      }
      if (!member) {
        member = await prisma.orgMember.findFirst({
          where: { userId },
          include: {
            user: { select: { id: true, email: true, name: true } },
            organization: { select: { id: true, name: true, slug: true } },
          },
        });
      }
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
