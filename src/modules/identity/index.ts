import { createHash, randomUUID } from 'node:crypto';
import { createAuthentication } from './application/authentication';
import { createOAuthAuthentication } from './application/oauth-authentication';
import { getOAuthProvider } from './infrastructure/oauth-providers';
import { passwords } from './infrastructure/passwords';
import { hashSessionToken, issueSessionToken } from './infrastructure/session-tokens';
import { sqliteIdentityStore } from './infrastructure/sqlite-identity-store';
import { sqliteOAuthStore } from './infrastructure/sqlite-oauth-store';

export const identity = createAuthentication({
  store: sqliteIdentityStore,
  passwords,
  newUserId: randomUUID,
  issueToken: issueSessionToken,
  tokenHash: hashSessionToken,
});

export const oauth = createOAuthAuthentication({
  store: sqliteOAuthStore,
  identity,
  providerFor: getOAuthProvider,
  newUserId: randomUUID,
  issueToken: issueSessionToken,
  tokenHash: hashSessionToken,
  codeChallenge: verifier => createHash('sha256').update(verifier).digest('base64url'),
});
