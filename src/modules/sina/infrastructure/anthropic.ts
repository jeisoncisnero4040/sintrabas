import Anthropic from '@anthropic-ai/sdk';
import { SinaProviderError } from '../application/chat';
import { sinaAgent } from '../domain/agent-profile';
import type { SinaMessage, SinaReply } from '../domain/conversation';

function readReply(blocks: Anthropic.ContentBlock[]): SinaReply {
  const text: string[] = [];
  const sources = new Map<string, { url: string; title: string }>();
  for (const block of blocks) {
    if (block.type !== 'text') continue;
    text.push(block.text);
    for (const citation of block.citations ?? []) {
      if (citation.type !== 'web_search_result_location') continue;
      const url = URL.parse(citation.url);
      if (url?.protocol !== 'https:' || url.username || url.password) continue;
      if (!sinaAgent.officialDomains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) continue;
      sources.set(url.href, { url: url.href, title: citation.title?.trim() || url.hostname });
    }
  }
  const answer = text.join('').trim();
  if (!answer) throw new SinaProviderError('empty');
  return { answer, sources: [...sources.values()] };
}

export async function generateWithAnthropic(messages: SinaMessage[], context: object | null, signal: AbortSignal) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new SinaProviderError('configuration');
  const model = process.env.ANTHROPIC_MODEL?.trim() || sinaAgent.model;
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const deadline = AbortSignal.timeout(45_000);
  const options = { signal: AbortSignal.any([signal, deadline]) };
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 1024,
    output_config: { effort: sinaAgent.effort },
    system: sinaAgent.instructions + '\nResponde en texto plano y de forma concisa.\nResumen de la aplicación: ' + JSON.stringify(context),
    messages,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, allowed_domains: [...sinaAgent.officialDomains] }],
  };

  try {
    const response = await client.messages.create(params, options);
    if (response.stop_reason !== 'pause_turn') return readReply(response.content);
    const resumed = await client.messages.create({
      ...params,
      messages: [...messages, { role: 'assistant', content: response.content }],
    }, options);
    return readReply([...response.content, ...resumed.content]);
  } catch (error) {
    if (error instanceof SinaProviderError) throw error;
    if (deadline.aborted || error instanceof Anthropic.APIConnectionTimeoutError) throw new SinaProviderError('timeout');
    if (error instanceof Anthropic.APIError) {
      console.warn('Sina recibió un error de Anthropic', { status: error.status, requestId: error.requestID });
      if (error.status === 429) throw new SinaProviderError('rate_limit');
      if (error.status === 400 || error.status === 401 || error.status === 402 || error.status === 403 || error.status === 404) {
        throw new SinaProviderError('configuration');
      }
    }
    throw new SinaProviderError('unavailable');
  }
}
