import { CONSENT_KINDS, ConsentError, LEGAL_VERSION, type ConsentEvidence } from '../domain/consent';

export function signupConsent(input: unknown, recordedAt: Date): ConsentEvidence[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ConsentError('CONSENT_REQUIRED', 'Acepta los términos y autoriza el tratamiento de datos.');
  }

  const { version, terms, data, marketing } = input as Record<string, unknown>;
  if (terms !== true || data !== true || typeof marketing !== 'boolean') {
    throw new ConsentError('CONSENT_REQUIRED', 'Acepta los términos y autoriza el tratamiento de datos.');
  }
  if (version !== LEGAL_VERSION) {
    throw new ConsentError('CONSENT_VERSION_MISMATCH', 'Recarga la página para consultar los textos legales vigentes.');
  }

  return CONSENT_KINDS.map(kind => ({
    kind,
    version,
    accepted: kind === 'marketing' ? marketing : true,
    recordedAt,
  }));
}
