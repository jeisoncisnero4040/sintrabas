import { createHmac } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { OAuthProviderAdapter } from '../application/oauth-provider';
import type { OAuthProvider } from '../domain/external-identity';

class OAuthProviderError extends Error {
  constructor() {
    super('No pudimos confirmar tu identidad con el proveedor.');
    this.name = 'OAuthProviderError';
  }
}

const REQUEST_TIMEOUT_MS = 5_000;
const META_EXCHANGE_TIMEOUT_MS = 10_000;
const META_DEFAULT_GRAPH_VERSION = 'v26.0';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  timeoutDuration: REQUEST_TIMEOUT_MS,
});

function urlWithParams(base: string, params: Record<string, string>): URL {
  const url = new URL(base);
  url.search = new URLSearchParams(params).toString();
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textClaim(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

async function fetchJson(url: URL, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
      redirect: 'error',
    });
    if (response.ok) {
      const payload: unknown = await response.json();
      if (isRecord(payload) && !Object.hasOwn(payload, 'error')) return payload;
    }
  } catch {
    throw new OAuthProviderError();
  }
  throw new OAuthProviderError();
}

function googleProvider(clientId: string, clientSecret: string): OAuthProviderAdapter {
  return {
    authorizationUrl({ redirectUri, state, codeChallenge, nonce }) {
      return urlWithParams('https://accounts.google.com/o/oauth2/v2/auth', {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
    },

    async exchange({ redirectUri, code, codeVerifier, nonce }) {
      const token = await fetchJson(new URL('https://oauth2.googleapis.com/token'), {
        method: 'POST',
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
        }),
      });
      if (typeof token.id_token !== 'string') throw new OAuthProviderError();

      try {
        const { payload } = await jwtVerify(token.id_token, googleKeys, {
          algorithms: ['RS256'],
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          audience: clientId,
          requiredClaims: ['sub', 'iat', 'exp', 'nonce'],
        });
        const subject = typeof payload.sub === 'string' && payload.sub.trim() ? payload.sub : undefined;
        const authorizedPartyValid = payload.azp === clientId || (payload.azp === undefined && payload.aud === clientId);
        if (!subject || !authorizedPartyValid || !nonce || payload.nonce !== nonce) throw new OAuthProviderError();

        const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
        return { subject, name: textClaim(payload.name), email: emailVerified ? textClaim(payload.email) : undefined };
      } catch {
        throw new OAuthProviderError();
      }
    },
  };
}

function isLiveTimestamp(value: unknown, now: number): boolean {
  return value === undefined || value === 0 || (typeof value === 'number' && Number.isSafeInteger(value) && value > now);
}

function matchesMetaAppId(value: unknown, appId: string): boolean {
  return value === appId || (typeof value === 'number' && Number.isSafeInteger(value) && String(value) === appId);
}

function metaProvider(appId: string, secret: string, graphVersion: string): OAuthProviderAdapter {
  const graphUrl = `https://graph.facebook.com/${graphVersion}`;
  const proof = (token: string) => createHmac('sha256', secret).update(token).digest('hex');

  return {
    authorizationUrl({ redirectUri, state }) {
      return urlWithParams(`https://www.facebook.com/${graphVersion}/dialog/oauth`, {
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'public_profile,email',
        state,
      }).toString();
    },

    async exchange({ redirectUri, code }) {
      const signal = AbortSignal.timeout(META_EXCHANGE_TIMEOUT_MS);
      const token = await fetchJson(urlWithParams(`${graphUrl}/oauth/access_token`, {
        client_id: appId,
        client_secret: secret,
        redirect_uri: redirectUri,
        code,
      }), { signal });
      const accessToken = textClaim(token.access_token);
      if (!accessToken) throw new OAuthProviderError();

      const appToken = `${appId}|${secret}`;
      const inspection = await fetchJson(urlWithParams(`${graphUrl}/debug_token`, {
        input_token: accessToken,
        appsecret_proof: proof(appToken),
      }), { signal, headers: { Authorization: `Bearer ${appToken}` } });
      const data = inspection.data;
      const now = Math.floor(Date.now() / 1_000);
      if (!isRecord(data) || !matchesMetaAppId(data.app_id, appId) || data.is_valid !== true
        || (data.type !== undefined && data.type !== 'USER')
        || !isLiveTimestamp(data.expires_at, now) || !isLiveTimestamp(data.data_access_expires_at, now)) {
        throw new OAuthProviderError();
      }

      const subject = textClaim(data.user_id);
      if (!subject) throw new OAuthProviderError();
      const profile = await fetchJson(urlWithParams(`${graphUrl}/me`, {
        fields: 'id,name,email',
        appsecret_proof: proof(accessToken),
      }), { signal, headers: { Authorization: `Bearer ${accessToken}` } });
      if (profile.id !== subject) throw new OAuthProviderError();
      return { subject, name: textClaim(profile.name), email: textClaim(profile.email) };
    },
  };
}

export function getOAuthProvider(provider: OAuthProvider): OAuthProviderAdapter | null {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    return clientId && clientSecret ? googleProvider(clientId, clientSecret) : null;
  }

  const appId = process.env.META_APP_ID?.trim();
  const secret = process.env.META_APP_SECRET?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim() || META_DEFAULT_GRAPH_VERSION;
  return appId && secret && /^v\d+\.\d+$/.test(version) ? metaProvider(appId, secret, version) : null;
}
