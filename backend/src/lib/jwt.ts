import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { logger } from './logger.js';

const KNOWN_PLACEHOLDERS = [
  'change_me',
  'changeme',
  'super-secret',
  'supersecret',
  'your-secret',
  'your_secret',
  'example',
  'placeholder',
  'default_secret',
  '123456789',
];

function isKnownPlaceholder(val: string): boolean {
  const lower = val.toLowerCase();
  return KNOWN_PLACEHOLDERS.some((p) => lower.includes(p));
}

function requireSecret(envVar: string, name: string): string {
  const value = process.env[envVar];
  if (value && value.length >= 32) {
    if (process.env.NODE_ENV === 'production' && isKnownPlaceholder(value)) {
      throw new Error(`FATAL: ${envVar} contains insecure placeholder value in production. Use a cryptographically secure random key.`);
    }
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL: ${envVar} must be set in production with at least 32 characters of high entropy.`);
  }
  // In development, generate a random secret and warn
  const generated = randomBytes(48).toString('hex');
  logger.warn({ envVar }, `${envVar} not set — using random secret. Set in .env for persistence.`);
  return generated;
}

const ACCESS_SECRET = requireSecret('JWT_SECRET', 'JWT access');
const REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET', 'JWT refresh');

if (process.env.NODE_ENV === 'production' && ACCESS_SECRET === REFRESH_SECRET) {
  throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be separate, distinct keys in production.');
}

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
  // jwtid makes every token unique: two issued in the same second for the
  // same user were byte-identical, so rotation could collide with itself.
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY, jwtid: randomBytes(12).toString('hex') });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}
