import { errorFields, log } from '../../log';
import { type ProviderInput, type ProviderResult, TutorError } from './types';

/**
 * A provider for servers that speak the OpenAI chat-completions protocol: Ollama,
 * llama.cpp, LM Studio, vLLM and the like. It exists so that the tutor can run entirely
 * on hardware the learner controls.
 *
 * It is deliberately minimal: plain `fetch`, streaming, no tools. Small local models call
 * tools unreliably, and a tutor that only sometimes verifies is worse than one that says
 * it cannot. The prompt tells the model that it has no tools (prompt.ts).
 */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface StreamChunk {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  model?: string;
}

export async function runLocal(input: ProviderInput): Promise<ProviderResult> {
  const { config } = input;
  const model = config.ai.model;
  if (!model) throw new TutorError('config', 'AI_MODEL must name the model to use with an OpenAI-compatible server');
  const baseUrl = config.ai.openaiBaseUrl || DEFAULT_BASE_URL;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(config.ai.openaiKey ? { Authorization: `Bearer ${config.ai.openaiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'system', content: `${input.instructions}\n\n${input.context}` }, ...input.turns],
      }),
      signal: input.signal,
    });
  } catch (error) {
    if (input.signal.aborted) throw new TutorError('aborted', 'the request was cancelled');
    log.warn('tutor: model server unreachable', { baseUrl, ...errorFields(error) });
    throw new TutorError('unreachable', `the model server at ${baseUrl} could not be reached`);
  }

  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    log.warn('tutor: model server returned an error', { status: response.status, detail });
    if (response.status === 401 || response.status === 403)
      throw new TutorError('auth', 'the model server rejected the API key');
    if (response.status === 429) throw new TutorError('rate_limit', 'the model server is rate limiting requests');
    if (response.status === 404) throw new TutorError('config', `the model server does not know the model "${model}"`);
    throw new TutorError('provider', `the model server returned an error (status ${response.status})`);
  }

  // Server-sent events: lines of `data: {json}`, ended by `data: [DONE]`.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let served = model;
  let finish: string | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '' || payload === '[DONE]') continue;
        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(payload) as StreamChunk;
        } catch {
          continue; // a keep-alive or a malformed line; the stream itself is still good
        }
        if (typeof chunk.model === 'string') served = chunk.model;
        const choice = chunk.choices?.[0];
        if (typeof choice?.delta?.content === 'string' && choice.delta.content !== '')
          input.onText(choice.delta.content);
        if (choice?.finish_reason) finish = choice.finish_reason;
      }
    }
  } catch (error) {
    if (input.signal.aborted) throw new TutorError('aborted', 'the request was cancelled');
    log.warn('tutor: stream from the model server broke', errorFields(error));
    throw new TutorError('unreachable', 'the connection to the model server was lost');
  }

  return { stop: finish === 'length' ? 'truncated' : 'complete', model: served, toolCalls: 0 };
}
