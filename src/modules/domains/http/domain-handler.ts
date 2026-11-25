import { authenticatedUser, handleRequest, json, RequestError } from '@/modules/identity/http/auth-handlers';
import { checkDomains } from '..';
import { InvalidDomainName } from '../domain/domain-name';

export const domainCheck = handleRequest(async request => {
  await authenticatedUser(request);
  try {
    return json({ data: checkDomains(request.nextUrl.searchParams.get('q')) }, 200);
  } catch (error) {
    if (error instanceof InvalidDomainName) throw new RequestError(422, 'INVALID_DOMAIN', 'Escribe un nombre de dominio válido.');
    throw error;
  }
});
