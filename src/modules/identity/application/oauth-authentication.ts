import { signupConsent } from '@/modules/privacy';
import { normalizeEmail } from '../domain/account';
import { OAuthError, OAUTH_PROVIDERS, type OAuthIntent, type OAuthProvider } from '../domain/external-identity';
import { IdentityError } from '../domain/identity-error';
import type { createAuthentication } from './authentication';
import type { OAuthProviderAdapter } from './oauth-provider';
import type { OAuthStore } from './oauth-store';

interface OAuthDependencies {
  store: OAuthStore;
  identity: Pick<ReturnType<typeof createAuthentication>, 'session' | 'prepareSession' | 'openSession'>;
  providerFor(provider: OAuthProvider): OAuthProviderAdapter | null;
  newUserId(): string;
  issueToken(): { token: string; hash: string };
  tokenHash(token: string | undefined): string | undefined;
  codeChallenge(verifier: string): string;
}

interface OAuthCallback {
  provider: OAuthProvider;
  state?: string;
  browserToken?: string;
  code?: string;
  providerError?: string;
  currentSessionToken?: string;
}

const FLOW_DURATION_MS = 10 * 60 * 1000;

function oauthIntent(intent: unknown): OAuthIntent {
  if (intent === 'login' || intent === 'signup' || intent === 'link') return intent;
  throw new IdentityError('INVALID_INPUT', 'Selecciona una operación de autenticación válida.');
}

function signupEmail(value: string | undefined) {
  try {
    return normalizeEmail(value);
  } catch {
    throw new OAuthError('OAUTH_EMAIL_REQUIRED', 'El proveedor debe compartir un correo válido para crear la cuenta.');
  }
}

function invalidState() {
  return new OAuthError('OAUTH_INVALID_STATE', 'El intento de acceso caducó o ya se usó. Vuelve a iniciarlo.');
}

function providerFailure() {
  return new OAuthError('OAUTH_PROVIDER_ERROR', 'No pudimos completar el acceso con el proveedor.');
}

function linkSession(expectedHash: string | undefined, currentHash: string | undefined) {
  if (!currentHash || expectedHash !== currentHash) {
    throw new IdentityError('UNAUTHENTICATED', 'Inicia sesión de nuevo para vincular tu cuenta.');
  }
  return currentHash;
}

export function createOAuthAuthentication(dependencies: OAuthDependencies) {
  const { store, identity, providerFor, newUserId, issueToken, tokenHash, codeChallenge } = dependencies;

  function adapterFor(provider: OAuthProvider) {
    const adapter = providerFor(provider);
    if (!adapter) throw new OAuthError('OAUTH_NOT_CONFIGURED', 'Este proveedor de acceso todavía no está disponible.');
    return adapter;
  }

  return {
    availableProviders() {
      return OAUTH_PROVIDERS.filter(provider => providerFor(provider) !== null);
    },

    async start(provider: OAuthProvider, redirectUri: string, input: Record<string, unknown>, sessionToken?: string) {
      const adapter = adapterFor(provider);
      const intent = oauthIntent(input.intent);
      const now = new Date();
      const consents = intent === 'signup' ? signupConsent(input.consent, now) : undefined;
      const linkSessionHash = intent === 'link' ? tokenHash(sessionToken) : undefined;

      if (intent === 'link') {
        await identity.session(sessionToken);
      }

      const state = issueToken();
      const browser = issueToken();
      const codeVerifier = issueToken().token;
      const nonce = issueToken().token;
      const expiresAt = new Date(now.getTime() + FLOW_DURATION_MS);
      const authorizationUrl = adapter.authorizationUrl({
        redirectUri, state: state.token, codeChallenge: codeChallenge(codeVerifier), nonce,
      });
      await store.createFlow({
        provider, intent, redirectUri, codeVerifier, nonce, consents, linkSessionHash,
        stateHash: state.hash, browserHash: browser.hash, expiresAt,
      }, now);
      return { authorizationUrl, state: state.token, browserToken: browser.token, expiresAt };
    },

    async finish({ provider, state, browserToken, code, providerError, currentSessionToken }: OAuthCallback) {
      const stateHash = tokenHash(state);
      const browserHash = tokenHash(browserToken);
      if (!stateHash || !browserHash) throw invalidState();
      const flow = await store.consumeFlow(provider, stateHash, browserHash, new Date());
      if (!flow) throw invalidState();

      if (providerError === 'access_denied') {
        throw new OAuthError('OAUTH_CANCELLED', 'Cancelaste el acceso con el proveedor.');
      }
      if (providerError || !code || code.length > 4096) throw providerFailure();

      const sessionHash = tokenHash(currentSessionToken);
      const linkSessionHash = flow.intent === 'link' ? linkSession(flow.linkSessionHash, sessionHash) : undefined;

      const adapter = adapterFor(provider);
      const profile = await adapter.exchange({
        redirectUri: flow.redirectUri, code, codeVerifier: flow.codeVerifier, nonce: flow.nonce,
      }).catch(() => { throw providerFailure(); });
      if (!profile.subject || profile.subject.length > 255) throw providerFailure();

      const externalIdentity = { provider, subject: profile.subject };
      if (linkSessionHash) {
        const outcome = await store.linkIdentity(externalIdentity, linkSessionHash, new Date());
        if (outcome === 'unauthenticated') {
          throw new IdentityError('UNAUTHENTICATED', 'Inicia sesión de nuevo para vincular tu cuenta.');
        }
        if (outcome === 'identity_conflict') {
          throw new OAuthError('OAUTH_IDENTITY_IN_USE', 'Esta cuenta o este proveedor ya están vinculados.');
        }
        return { kind: 'linked' } as const;
      }

      const existingUser = await store.findByExternalIdentity(externalIdentity);
      if (existingUser) {
        return { kind: 'session', ...await identity.openSession(existingUser, currentSessionToken) } as const;
      }
      if (flow.intent !== 'signup' || !flow.consents) {
        throw new OAuthError('OAUTH_ACCOUNT_NOT_FOUND', 'Crea una cuenta o vincula este proveedor a tu cuenta existente.');
      }

      const email = signupEmail(profile.email);
      const name = (profile.name?.trim() || email.split('@')[0]).slice(0, 120).trim();
      const user = { id: newUserId(), name, email };
      const { token, session } = identity.prepareSession(user.id, new Date());
      const outcome = await store.registerExternal({
        identity: externalIdentity, user, session, consents: flow.consents, previousTokenHash: sessionHash,
      });
      if (outcome === 'email_conflict') {
        throw new OAuthError('OAUTH_EMAIL_IN_USE', 'Inicia sesión con tu método actual y vincula el proveedor desde tu cuenta.');
      }
      if (outcome === 'identity_exists') {
        const registeredUser = await store.findByExternalIdentity(externalIdentity);
        if (!registeredUser) throw providerFailure();
        return { kind: 'session', ...await identity.openSession(registeredUser, currentSessionToken) } as const;
      }
      return { kind: 'session', token, expiresAt: session.expiresAt } as const;
    },
  };
}
