import { authenticatedUser, handleRequest, json, readJson, RequestError, requireSameOrigin } from '@/modules/identity/http/auth-handlers';
import { getAllyApplications, submitAllyApplication } from '..';
import { InvalidAllyApplication } from '../domain/application';

export const applicationsGet = handleRequest(async request => {
  const user = await authenticatedUser(request);
  return json({ data: getAllyApplications(user.id) }, 200);
});

export const applicationsPost = handleRequest(async request => {
  requireSameOrigin(request);
  const user = await authenticatedUser(request);
  const input = await readJson(request);
  try {
    return json({ data: submitAllyApplication(user.id, input) }, 200);
  } catch (error) {
    if (error instanceof InvalidAllyApplication) throw new RequestError(422, 'INVALID_ALLY_APPLICATION', error.message);
    throw error;
  }
});
