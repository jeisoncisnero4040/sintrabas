import { authenticatedUser, handleRequest, json, readJson, RequestError, requireSameOrigin } from '@/modules/identity/http/auth-handlers';
import { opt } from '..';
import { OptQueryError } from '../domain/opt';

export const optGet = handleRequest(async request => {
  await authenticatedUser(request);
  return json({ data: opt.catalog() }, 200);
});

export const optPost = handleRequest(async request => {
  requireSameOrigin(request);
  await authenticatedUser(request);
  const input = await readJson(request);
  try {
    return json({ data: opt.lookup(input) }, 200);
  } catch (error) {
    if (error instanceof OptQueryError) throw new RequestError(422, 'INVALID_OPT_QUERY', error.message);
    throw error;
  }
});
