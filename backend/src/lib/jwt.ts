import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { logger } from './logger.js';

function requireSecret(envVar: string, name: string): string {
  const value = process.env[envVar];
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL: ${envVar} must be set in production (min 32 chars)`);
  }
  // In development, generate a random secret and warn
  const generated = randomBytes(48).toString('hex');
  logger.warn({ envVar }, `${envVar} not set — using random secret. Set in .env for persistence.`);
  return generated;
}

const ACCESS_SECRET = requireSecret('JWT_SECRET', 'JWT access');
const REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET', 'JWT refresh');

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}
