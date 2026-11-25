import { authenticatedUser, handleRequest, json, readJson, RequestError, requireSameOrigin } from '@/modules/identity/http/auth-handlers';
import { getWorkspace, updateWorkspace } from '..';
import { InvalidWorkspace } from '../domain/workspace-state';

export const workspaceGet = handleRequest(async request => {
  const user = await authenticatedUser(request);
  return json({ data: getWorkspace(user.id) }, 200);
});

export const workspacePut = handleRequest(async request => {
  requireSameOrigin(request);
  const user = await authenticatedUser(request);
  const input = await readJson(request, 48 * 1024);
  try {
    const saved = updateWorkspace(user.id, input);
    if (!saved) throw new RequestError(409, 'WORKSPACE_CONFLICT', 'Tu espacio cambió en otra pestaña. Recarga los datos e inténtalo de nuevo.');
    return json({ data: saved }, 200);
  } catch (error) {
    if (error instanceof InvalidWorkspace) throw new RequestError(422, 'INVALID_WORKSPACE', 'Revisa los datos de tu diagnóstico.');
    throw error;
  }
});
