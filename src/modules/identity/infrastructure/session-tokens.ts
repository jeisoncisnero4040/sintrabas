import { createHash, randomBytes } from 'node:crypto';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function issueSessionToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashSessionToken(token: string | undefined) {
  return token && /^[A-Za-z0-9_-]{43}$/u.test(token) ? hashToken(token) : undefined;
}
