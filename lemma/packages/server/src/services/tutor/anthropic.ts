import Anthropic from '@anthropic-ai/sdk';
import { errorFields, log } from '../../log';
import { TOOL_DEFINITIONS, executeTool } from './tools';
import { type ProviderInput, type ProviderResult, TutorError } from './types';

/**
 * The Claude provider: the official SDK, streaming, with a manual tool loop.
 *
 * The loop is manual rather than the SDK's tool runner because each round has to be
 * relayed to the browser as it happens (text deltas, "a tool is being called") and
 * because a round that fails has to be taken back from what the browser already showed.
 */

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

/** A reply may call tools this many rounds; then it is asked to answer with what it has. */
const MAX_TOOL_ROUNDS = 8;
const MAX_JSON_RETRIES = 2;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/**
 * Request features by model generation. This provider is written for the Claude 5 family;
 * any other model id gets the plainest valid request instead of a 400.
 */
function featuresOf(model: string): { adaptive: boolean; fallbacks: boolean } {
  return {
    // Adaptive thinking, with effort as the control for how much of it there is.
    adaptive: /^claude-(opus|sonnet|fable|mythos)-5/.test(model),
    // These models have safety classifiers that can decline a harmless request; the
    // server-side fallback re-runs a declined request on the model Anthropic recommends.
    fallbacks: /^claude-opus-5/.test(model),
  };
}

/**
 * After a fallback in the middle of a reply, the blocks the declining model produced
 * before the switch must not be sent back, except its text. Tool calls among them are
 * therefore not executed either.
 */
function echoable(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlock[] {
  const boundary = content.findLastIndex((block) => block.type === 'fallback');
  if (boundary === -1) return content;
  return content.filter((block, index) => index >= boundary || block.type === 'text');
}

function toTutorError(error: unknown): TutorError {
  if (error instanceof TutorError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return new TutorError('aborted', 'the request was cancelled');
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new TutorError('auth', 'the Anthropic API key was rejected');
  }
  if (error instanceof Anthropic.RateLimitError)
    return new TutorError('rate_limit', 'the Anthropic API rate limit was reached');
  if (error instanceof Anthropic.APIConnectionError)
    return new TutorError('unreachable', 'the Anthropic API could not be reached');
  if (error instanceof Anthropic.APIError) {
    if (error.status === 529 || error.status === 503)
      return new TutorError('overloaded', 'the Anthropic API is overloaded');
    return new TutorError('provider', `the Anthropic API returned an error (status ${error.status ?? 'unknown'})`);
  }
  return new TutorError('provider', 'the tutor failed unexpectedly');
}

export async function runClaude(input: ProviderInput): Promise<ProviderResult> {
  const { config } = input;
  if (!config.ai.anthropicKey) throw new TutorError('config', 'ANTHROPIC_API_KEY is not set');
  const model = config.ai.model || DEFAULT_CLAUDE_MODEL;
  const features = featuresOf(model);
  const client = new Anthropic({ apiKey: config.ai.anthropicKey });

  // Tools and system prompt are built once and stay byte-identical for every round of
  // this reply: the thinking blocks sent back in the loop are only valid for the exact
  // prefix that produced them, and the prompt cache matches on the same prefix.
  const tools: Anthropic.Beta.BetaTool[] = TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    // Inputs stream as they are generated; in exchange they are validated here (tools.ts).
    eager_input_streaming: true,
  }));
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: input.instructions, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: input.context },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = input.turns.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  let sent = 0;
  let rounds = 0;
  let toolCalls = 0;
  let jsonRetries = 0;

  try {
    for (;;) {
      let roundChars = 0;
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: config.ai.maxTokens,
          system,
          tools,
          messages,
          ...(features.adaptive
            ? { thinking: { type: 'adaptive' as const }, output_config: { effort: config.ai.effort } }
            : {}),
          ...(features.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
        },
        { signal: input.signal },
      );
      stream.on('text', (delta) => {
        // Text from separate rounds would otherwise run together.
        const piece = roundChars === 0 && sent > 0 ? `\n\n${delta}` : delta;
        roundChars += piece.length;
        sent += piece.length;
        input.onText(piece);
      });
      const retractRound = (): void => {
        if (roundChars === 0) return;
        input.onRetract(roundChars);
        sent -= roundChars;
        roundChars = 0;
      };

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        retractRound();
        // With eager input streaming the SDK rejects here when a tool input is not JSON at
        // all. Only that is retried; API errors (auth, rate limit, abort) are real.
        if (error instanceof Anthropic.APIError || jsonRetries++ >= MAX_JSON_RETRIES) throw error;
        log.warn('tutor: a tool input could not be parsed, re-issuing the turn', errorFields(error));
        continue;
      }

      log.debug('tutor round', {
        model: message.model,
        stop: message.stop_reason,
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens,
        cacheWrite: message.usage.cache_creation_input_tokens,
      });

      // A refusal can arrive after partial output, and can cut a tool call off mid-input:
      // nothing from this round is kept and none of its tools run.
      if (message.stop_reason === 'refusal') {
        retractRound();
        return { stop: 'refused', model: message.model, toolCalls };
      }

      const content = echoable(message.content);
      const toolUses = content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use');
      const truncated = message.stop_reason === 'max_tokens' || message.stop_reason === 'model_context_window_exceeded';
      if (toolUses.length === 0) return { stop: truncated ? 'truncated' : 'complete', model: message.model, toolCalls };
      // A tool input cut off by the output limit usually still parses, as a shorter object.
      // The stop reason is what gives it away, so the tools are not run.
      if (truncated) return { stop: 'truncated', model: message.model, toolCalls };

      rounds++;
      if (rounds > MAX_TOOL_ROUNDS + 1) return { stop: 'truncated', model: message.model, toolCalls };
      const exhausted = rounds > MAX_TOOL_ROUNDS;

      messages.push({ role: 'assistant', content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        if (exhausted) {
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            is_error: true,
            content: 'No more tool calls are available for this reply. Answer now with what you have established.',
          });
          continue;
        }
        input.onTool(use.name);
        toolCalls++;
        const outcome = executeTool(use.name, use.input, input.tools);
        if (outcome.ok) {
          results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(outcome.result) });
        } else if (outcome.invalid) {
          // Hand the input back as received so the model can see what arrived and resend it.
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            is_error: true,
            content: JSON.stringify({ INVALID_JSON: JSON.stringify(use.input) }),
          });
        } else {
          results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: outcome.error });
        }
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (error) {
    const mapped = toTutorError(error);
    if (mapped.code !== 'aborted') log.warn('tutor: request failed', { code: mapped.code, ...errorFields(error) });
    throw mapped;
  }
}
