import type { ConsentEvidence } from '@/modules/privacy';
import type { PublicUser } from '../domain/account';
import type { ExternalIdentity, OAuthIntent, OAuthProvider } from '../domain/external-identity';
import type { SessionRecord } from './identity-store';

export interface OAuthFlow {
  provider: OAuthProvider;
  intent: OAuthIntent;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
  consents?: readonly ConsentEvidence[];
  linkSessionHash?: string;
}

export interface OAuthFlowRecord extends OAuthFlow {
  stateHash: string;
  browserHash: string;
  expiresAt: Date;
}

export interface ExternalRegistration {
  identity: ExternalIdentity;
  user: PublicUser;
  session: SessionRecord;
  consents: readonly ConsentEvidence[];
  previousTokenHash?: string;
}

export interface OAuthStore {
  createFlow(flow: OAuthFlowRecord, now: Date): Promise<void>;
  consumeFlow(provider: OAuthProvider, stateHash: string, browserHash: string, now: Date): Promise<OAuthFlow | null>;
  findByExternalIdentity(identity: ExternalIdentity): Promise<PublicUser | null>;
  registerExternal(registration: ExternalRegistration): Promise<'created' | 'email_conflict' | 'identity_exists'>;
  linkIdentity(
    identity: ExternalIdentity, sessionTokenHash: string, now: Date
  ): Promise<'linked' | 'identity_conflict' | 'unauthenticated'>;
}
