type IdentityErrorCode = 'INVALID_INPUT' | 'INVALID_CREDENTIALS' | 'EMAIL_ALREADY_REGISTERED' | 'UNAUTHENTICATED';

export class IdentityError extends Error {
  constructor(public readonly code: IdentityErrorCode, message: string) {
    super(message);
  }
}
