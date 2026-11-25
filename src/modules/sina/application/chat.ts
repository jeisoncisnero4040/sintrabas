import { readConversation, type SinaMessage, type SinaReply } from '../domain/conversation';

interface RouteContext {
  etapaDiagnostico: number;
  rutaGenerada: boolean;
  actividad: string;
  modalidadUbicacion: string;
  figuraJuridica: string;
  tramitesCompletados: string[];
}

interface SinaDependencies {
  readContext(userId: string): RouteContext | null;
  generate(messages: SinaMessage[], context: object | null, signal: AbortSignal): Promise<SinaReply>;
}

export class SinaProviderError extends Error {
  constructor(readonly kind: 'configuration' | 'rate_limit' | 'timeout' | 'unavailable' | 'empty') {
    super(kind);
  }
}

export function createSinaChat({ readContext, generate }: SinaDependencies) {
  return async (userId: string, input: Record<string, unknown>, signal: AbortSignal) => {
    const { conversation, nextProcedure } = readConversation(input);
    const route = readContext(userId);
    const context = route?.rutaGenerada && nextProcedure ? { ...route, siguienteTramiteMostrado: nextProcedure } : route;
    return generate(conversation, context, signal);
  };
}
