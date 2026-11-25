export interface ExternalProfile {
  subject: string;
  name?: string;
  email?: string;
}

export interface OAuthProviderAdapter {
  authorizationUrl(input: {
    redirectUri: string;
    state: string;
    codeChallenge: string;
    nonce: string;
  }): string;
  exchange(input: {
    redirectUri: string;
    code: string;
    codeVerifier: string;
    nonce: string;
  }): Promise<ExternalProfile>;
}
