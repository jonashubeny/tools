import type { Config } from '../../config';
import type { ToolContext } from './tools';

/** What a tutor provider is given and what it returns. Providers differ only below this line. */

export interface TutorTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderInput {
  config: Config;
  /** Identical for every request, so the provider may cache it. */
  instructions: string;
  /** Who is asking, about what, in which mode. Differs per request. */
  context: string;
  /** The conversation so far, ending with the learner's new message. */
  turns: TutorTurn[];
  tools: ToolContext;
  signal: AbortSignal;
  onText: (delta: string) => void;
  /** Take back the last `chars` characters sent through `onText`. */
  onRetract: (chars: number) => void;
  /** A tool is being called; lets the UI show that something is being checked. */
  onTool: (name: string) => void;
}

export interface ProviderResult {
  /**
   * complete: the reply ended normally. truncated: it ran out of output budget.
   * refused: the provider declined to answer; nothing of the reply should be kept.
   */
  stop: 'complete' | 'truncated' | 'refused';
  /** The model that produced the reply; may differ from the configured one after a fallback. */
  model: string;
  toolCalls: number;
}

export type TutorErrorCode = 'config' | 'auth' | 'rate_limit' | 'overloaded' | 'unreachable' | 'aborted' | 'provider';

/** A provider failure in a form the UI can explain. */
export class TutorError extends Error {
  constructor(
    readonly code: TutorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TutorError';
  }
}

export type Provider = (input: ProviderInput) => Promise<ProviderResult>;
