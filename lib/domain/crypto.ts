import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '@/lib/env';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const secret = env.leadosSecretsKey;
  if (!secret) {
    throw new Error('Missing LEADOS_SECRETS_KEY');
  }

  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('LEADOS_SECRETS_KEY must be base64 for 32 raw bytes');
  }

  return key;
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encryptedB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
