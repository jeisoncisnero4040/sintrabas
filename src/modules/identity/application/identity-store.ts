import type { ConsentEvidence } from '@/modules/privacy';
import type { Account, PublicUser } from '../domain/account';

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

export interface RegistrationRecord {
  user: Account;
  session: SessionRecord;
  consents: readonly ConsentEvidence[];
  previousTokenHash?: string;
}

export interface IdentityStore {
  findByEmail(email: string): Promise<Account | null>;
  findBySessionTokenHash(tokenHash: string, now: Date): Promise<PublicUser | null>;
  register(registration: RegistrationRecord): Promise<'created' | 'email_conflict'>;
  createSession(session: SessionRecord, previousTokenHash?: string): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
}
