export const LEGAL_VERSION = '2026-11';
export const CONSENT_KINDS = ['terms', 'data', 'marketing'] as const;

export interface ConsentEvidence {
  kind: typeof CONSENT_KINDS[number];
  version: string;
  accepted: boolean;
  recordedAt: Date;
}

type ConsentErrorCode = 'CONSENT_REQUIRED' | 'CONSENT_VERSION_MISMATCH';

export class ConsentError extends Error {
  constructor(public readonly code: ConsentErrorCode, message: string) {
    super(message);
  }
}
