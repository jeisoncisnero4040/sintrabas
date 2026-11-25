import { authenticatedUser, handleRequest, json, readJson, RequestError, requireSameOrigin } from '@/modules/identity/http/auth-handlers';
import { askSina } from '..';
import { SinaProviderError } from '../application/chat';
import { InvalidConversation } from '../domain/conversation';

const providerErrors = {
  configuration: [503, 'SINA_NOT_CONFIGURED', 'Sina no está disponible en este momento.'],
  rate_limit: [429, 'SINA_RATE_LIMIT', 'Sina está recibiendo muchas consultas. Intenta de nuevo en un momento.'],
  timeout: [504, 'SINA_TIMEOUT', 'Sina tardó demasiado en responder. Puedes intentar de nuevo.'],
  unavailable: [502, 'SINA_UNAVAILABLE', 'No pudimos conectar con Sina. Puedes intentar de nuevo.'],
  empty: [502, 'SINA_EMPTY_REPLY', 'Sina no devolvió una respuesta. Intenta con una pregunta más concreta.'],
} as const;

export const sinaPost = handleRequest(async request => {
  requireSameOrigin(request);
  const user = await authenticatedUser(request);
  const input = await readJson(request, 40 * 1024);
  try {
    return json({ data: await askSina(user.id, input, request.signal) }, 200);
  } catch (error) {
    if (error instanceof InvalidConversation) throw new RequestError(422, 'INVALID_SINA_CONVERSATION', error.message);
    if (error instanceof SinaProviderError) {
      const [status, code, message] = providerErrors[error.kind];
      throw new RequestError(status, code, message);
    }
    throw error;
  }
});
