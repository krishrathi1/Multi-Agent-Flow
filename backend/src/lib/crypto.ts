import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import { logger } from './logger.js';

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `nxk_${randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 12);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// AES-256-GCM encryption for sensitive data at rest (gateway tokens, LLM API keys)
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ENCRYPTION_KEY must be set in production (64 hex chars = 32 bytes)');
    }
    // In development, warn but use a deterministic fallback (NOT for production)
    logger.warn('ENCRYPTION_KEY not set — sensitive data stored as plaintext. Set ENCRYPTION_KEY in .env');
    return Buffer.alloc(0);
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string. Returns "enc:<iv>:<authTag>:<ciphertext>" format.
 * If no encryption key is configured, returns plaintext (dev mode only).
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  if (key.length === 0) return plaintext; // dev fallback

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an encrypted string. Handles both encrypted ("enc:...") and plaintext (legacy) formats.
 */
export function decryptField(ciphertext: string): string {
  if (!ciphertext.startsWith('enc:')) {
    return ciphertext; // plaintext (legacy or dev mode)
  }

  const key = getEncryptionKey();
  if (key.length === 0) {
    throw new Error('Cannot decrypt: ENCRYPTION_KEY not configured');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted format');

  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = Buffer.from(parts[3], 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
}
