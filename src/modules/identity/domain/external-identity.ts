export const OAUTH_PROVIDERS = ['google', 'meta'] as const;

export type OAuthProvider = typeof OAUTH_PROVIDERS[number];
export type OAuthIntent = 'login' | 'signup' | 'link';

export interface ExternalIdentity {
  provider: OAuthProvider;
  subject: string;
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === 'google' || value === 'meta';
}

type OAuthErrorCode =
  | 'OAUTH_CANCELLED'
  | 'OAUTH_INVALID_STATE'
  | 'OAUTH_NOT_CONFIGURED'
  | 'OAUTH_PROVIDER_ERROR'
  | 'OAUTH_ACCOUNT_NOT_FOUND'
  | 'OAUTH_EMAIL_IN_USE'
  | 'OAUTH_EMAIL_REQUIRED'
  | 'OAUTH_IDENTITY_IN_USE';

export class OAuthError extends Error {
  constructor(public readonly code: OAuthErrorCode, message: string) {
    super(message);
  }
}
