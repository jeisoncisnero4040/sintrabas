import { IdentityError } from './identity-error';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface Account extends PublicUser {
  passwordHash: string;
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new IdentityError('INVALID_INPUT', 'Ingresa un correo válido.');
  }
  return email;
}

export function validateName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 120) {
    throw new IdentityError('INVALID_INPUT', 'Escribe un nombre de hasta 120 caracteres.');
  }
  return name;
}

export function validatePassword(value: unknown, isRegistration: boolean): string {
  const minimum = isRegistration ? 8 : 1;
  if (typeof value !== 'string' || value.length < minimum || value.length > 128) {
    throw new IdentityError('INVALID_INPUT', isRegistration
      ? 'La contraseña debe tener entre 8 y 128 caracteres.'
      : 'Ingresa una contraseña de hasta 128 caracteres.');
  }
  return value;
}

export function publicUser({ id, name, email }: Account): PublicUser {
  return { id, name, email };
}
