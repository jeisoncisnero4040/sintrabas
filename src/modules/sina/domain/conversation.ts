const MAX_MESSAGES = 9;
const MAX_QUESTION_LENGTH = 300;
const MAX_REPLY_CONTEXT_LENGTH = 2400;

export interface SinaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SinaReply {
  answer: string;
  sources: { url: string; title: string }[];
}

export class InvalidConversation extends Error {}

export function readConversation(input: Record<string, unknown>) {
  const { messages, nextProcedure } = input;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES || messages.length % 2 === 0) {
    throw new InvalidConversation('Envía una pregunta para Sina.');
  }
  const conversation = messages.map<SinaMessage>((message, index) => {
    const role = index % 2 === 0 ? 'user' : 'assistant';
    const limit = role === 'user' ? MAX_QUESTION_LENGTH : MAX_REPLY_CONTEXT_LENGTH;
    if (!message || typeof message !== 'object' || message.role !== role
      || typeof message.content !== 'string' || !message.content.trim() || message.content.length > limit) {
      throw new InvalidConversation('Revisa la pregunta y el historial antes de enviarlos.');
    }
    return { role, content: message.content.trim() };
  });
  if (nextProcedure !== undefined && (typeof nextProcedure !== 'string' || nextProcedure.length > 250)) {
    throw new InvalidConversation('El resumen de la ruta tiene un formato inválido.');
  }
  return { conversation, nextProcedure: nextProcedure?.trim() };
}
