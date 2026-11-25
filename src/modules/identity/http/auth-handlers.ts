import { NextResponse, type NextRequest } from 'next/server';
import { ConsentError } from '@/modules/privacy';
import { identity, oauth } from '..';
import { isOAuthProvider, OAuthError, type OAuthProvider } from '../domain/external-identity';
import { IdentityError } from '../domain/identity-error';

const COOKIE_NAME = 'stb_session';
const MAX_BODY_SIZE = 8192;
const OAUTH_PATH = '/api/v1/auth/oauth';
const OAUTH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

interface OAuthRouteContext {
  params: Promise<{ provider: string }>;
}

const STATUS_BY_CODE = {
  INVALID_INPUT: 422,
  CONSENT_REQUIRED: 422,
  CONSENT_VERSION_MISMATCH: 422,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  EMAIL_ALREADY_REGISTERED: 409,
  OAUTH_CANCELLED: 400,
  OAUTH_INVALID_STATE: 400,
  OAUTH_NOT_CONFIGURED: 503,
  OAUTH_PROVIDER_ERROR: 502,
  OAUTH_ACCOUNT_NOT_FOUND: 404,
  OAUTH_EMAIL_IN_USE: 409,
  OAUTH_EMAIL_REQUIRED: 422,
  OAUTH_IDENTITY_IN_USE: 409,
} as const;

export class RequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function cookieToken(request: NextRequest) {
  return request.cookies.get(COOKIE_NAME)?.value;
}

export function authenticatedUser(request: NextRequest) {
  return identity.session(cookieToken(request));
}

function setAuthCookie(response: NextResponse, name: string, token: string, expires: Date, path = '/') {
  const configured = process.env.AUTH_SECURE_COOKIE;
  const secure = configured === 'false' ? false : configured === 'true' || process.env.NODE_ENV === 'production';
  response.cookies.set(name, token, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path,
  });
}

function requestOrigin(request: NextRequest) {
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || request.nextUrl.protocol.slice(0, -1);
  const host = request.headers.get('host') || request.nextUrl.host;
  return process.env.AUTH_ORIGIN || `${protocol}://${host}`;
}

export function requireSameOrigin(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');

  if (fetchSite === 'cross-site' || fetchSite === 'same-site' || (origin !== null && origin !== requestOrigin(request))) {
    throw new RequestError(403, 'ORIGIN_NOT_ALLOWED', 'La solicitud proviene de un origen no autorizado.');
  }
}

function oauthOrigin(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_ORIGIN) return null;
  try {
    const value = requestOrigin(request);
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

async function routeProvider({ params }: OAuthRouteContext) {
  const { provider } = await params;
  if (isOAuthProvider(provider)) return provider;
  throw new OAuthError('OAUTH_NOT_CONFIGURED', 'Este proveedor de acceso todavía no está disponible.');
}

function oauthCookieName(state: string) {
  return `stb_oauth_${state}`;
}

function oauthRedirect(options?: { error: string } | { provider: OAuthProvider }) {
  const query = new URLSearchParams();
  if (options && 'error' in options) query.set('oauth_error', options.error);
  if (options && 'provider' in options) {
    query.set('oauth_status', 'linked');
    query.set('oauth_provider', options.provider);
  }
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: query.size ? `/?${query.toString()}` : '/',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function readJson(request: NextRequest, maxBodySize = MAX_BODY_SIZE): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new RequestError(415, 'UNSUPPORTED_CONTENT_TYPE', 'Envía los datos en formato JSON.');
  }

  const reader = request.body?.getReader();
  const bytes = new Uint8Array(maxBodySize);
  let length = 0;
  if (reader) {
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        if (length + chunk.value.byteLength > maxBodySize) {
          await reader.cancel();
          throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud supera el tamaño permitido.');
        }
        bytes.set(chunk.value, length);
        length += chunk.value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
  }

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
  } catch {
    throw new RequestError(400, 'INVALID_JSON', 'El cuerpo de la solicitud debe contener JSON válido.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new IdentityError('INVALID_INPUT', 'Envía los campos de autenticación en un objeto.');
  }
  return input as Record<string, unknown>;
}

export function handleRequest<Args extends unknown[]>(operation: (request: NextRequest, ...args: Args) => Promise<NextResponse>) {
  return async (request: NextRequest, ...args: Args) => {
    try {
      return await operation(request, ...args);
    } catch (error) {
      if (error instanceof IdentityError || error instanceof ConsentError || error instanceof OAuthError) {
        return json({ error: { code: error.code, message: error.message } }, STATUS_BY_CODE[error.code]);
      }
      if (error instanceof RequestError) {
        return json({ error: { code: error.code, message: error.message } }, error.status);
      }
      console.error('Error en autenticación', error instanceof Error ? error.name : 'UnknownError');
      return json({ error: { code: 'INTERNAL_ERROR', message: 'No pudimos completar la solicitud.' } }, 500);
    }
  };
}

export const registerHandler = handleRequest(async request => {
  requireSameOrigin(request);
  const { user, token, expiresAt } = await identity.register(await readJson(request), cookieToken(request));
  const response = json({ data: { user } }, 201);
  setAuthCookie(response, COOKIE_NAME, token, expiresAt);
  return response;
});

export const loginHandler = handleRequest(async request => {
  requireSameOrigin(request);
  const { user, token, expiresAt } = await identity.login(await readJson(request), cookieToken(request));
  const response = json({ data: { user } }, 200);
  setAuthCookie(response, COOKIE_NAME, token, expiresAt);
  return response;
});

export const sessionHandler = handleRequest(async request => {
  const user = await authenticatedUser(request);
  return json({ data: { user } }, 200);
});

export const logoutHandler = handleRequest(async request => {
  requireSameOrigin(request);
  await identity.logout(cookieToken(request));
  const response = json({ data: {} }, 200);
  setAuthCookie(response, COOKIE_NAME, '', new Date(0));
  return response;
});

export const oauthProvidersHandler = handleRequest(async request => {
  const providers = oauthOrigin(request) ? oauth.availableProviders() : [];
  return json({ data: { providers } }, 200);
});

export const oauthStartHandler = handleRequest(async (request, context: OAuthRouteContext) => {
  requireSameOrigin(request);
  const provider = await routeProvider(context);
  const origin = oauthOrigin(request);
  if (!origin) throw new OAuthError('OAUTH_NOT_CONFIGURED', 'El origen público OAuth no está configurado.');
  const redirectUri = new URL(`${OAUTH_PATH}/${provider}/callback`, origin).href;
  const { authorizationUrl, state, browserToken, expiresAt } = await oauth.start(
    provider, redirectUri, await readJson(request), cookieToken(request),
  );
  const response = json({ data: { authorizationUrl } }, 200);
  setAuthCookie(response, oauthCookieName(state), browserToken, expiresAt, OAUTH_PATH);
  return response;
});

export async function oauthCallbackHandler(request: NextRequest, context: OAuthRouteContext) {
  const { searchParams } = request.nextUrl;
  const state = searchParams.get('state') ?? undefined;
  const name = state && OAUTH_TOKEN_PATTERN.test(state) ? oauthCookieName(state) : undefined;
  let response: NextResponse;
  try {
    const provider = await routeProvider(context);
    const result = await oauth.finish({
      provider,
      state,
      browserToken: name ? request.cookies.get(name)?.value : undefined,
      code: searchParams.get('code') ?? undefined,
      providerError: searchParams.get('error') ?? undefined,
      currentSessionToken: cookieToken(request),
    });
    response = result.kind === 'linked' ? oauthRedirect({ provider }) : oauthRedirect();
    if (result.kind === 'session') {
      setAuthCookie(response, COOKIE_NAME, result.token, result.expiresAt);
    }
  } catch (error) {
    if (error instanceof OAuthError || (error instanceof IdentityError && error.code === 'UNAUTHENTICATED')) {
      response = oauthRedirect({ error: error.code });
    } else {
      console.error('Error en OAuth', error instanceof Error ? error.name : 'UnknownError');
      response = oauthRedirect({ error: 'OAUTH_PROVIDER_ERROR' });
    }
  }
  if (name) setAuthCookie(response, name, '', new Date(0), OAUTH_PATH);
  return response;
}
