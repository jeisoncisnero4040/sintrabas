import { signupConsent } from '@/modules/privacy';
import { normalizeEmail, publicUser, validateName, validatePassword, type Account, type PublicUser } from '../domain/account';
import { IdentityError } from '../domain/identity-error';
import type { IdentityStore } from './identity-store';

interface AuthenticationDependencies {
  store: IdentityStore;
  passwords: {
    hash(password: string): Promise<string>;
    verify(password: string, hash: string | undefined): Promise<boolean>;
  };
  newUserId(): string;
  issueToken(): { token: string; hash: string };
  tokenHash(token: string | undefined): string | undefined;
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function createAuthentication({ store, passwords, newUserId, issueToken, tokenHash }: AuthenticationDependencies) {
  function prepareSession(userId: string, now: Date) {
    const { token, hash } = issueToken();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    return { token, session: { tokenHash: hash, userId, expiresAt } };
  }

  async function openSession(user: PublicUser, previousToken?: string) {
    const { token, session } = prepareSession(user.id, new Date());
    await store.createSession(session, tokenHash(previousToken));
    return { user, token, expiresAt: session.expiresAt };
  }

  return {
    prepareSession,
    openSession,

    async register(input: Record<string, unknown>, previousToken?: string) {
      const name = validateName(input.name);
      const email = normalizeEmail(input.email);
      const password = validatePassword(input.password, true);
      const now = new Date();
      const consents = signupConsent(input.consent, now);
      const user: Account = { id: newUserId(), name, email, passwordHash: await passwords.hash(password) };
      const { token, session } = prepareSession(user.id, now);
      const result = await store.register({ user, session, consents, previousTokenHash: tokenHash(previousToken) });
      if (result === 'email_conflict') {
        throw new IdentityError('EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con ese correo.');
      }
      return { user: publicUser(user), token, expiresAt: session.expiresAt };
    },

    async login(input: Record<string, unknown>, previousToken?: string) {
      const email = normalizeEmail(input.email);
      const password = validatePassword(input.password, false);
      const user = await store.findByEmail(email);
      const validPassword = await passwords.verify(password, user?.passwordHash);
      if (!user || !validPassword) {
        throw new IdentityError('INVALID_CREDENTIALS', 'El correo o la contraseña son incorrectos.');
      }
      return openSession(publicUser(user), previousToken);
    },

    async session(token?: string) {
      const hash = tokenHash(token);
      const user = hash ? await store.findBySessionTokenHash(hash, new Date()) : null;
      if (!user) throw new IdentityError('UNAUTHENTICATED', 'Inicia sesión para continuar.');
      return user;
    },

    async logout(token?: string) {
      const hash = tokenHash(token);
      if (hash) await store.deleteSession(hash);
    },
  };
}
