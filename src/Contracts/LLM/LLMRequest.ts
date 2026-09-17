import type { LLMMessage } from './LLMMessage.js';

/**
 * Represents a request to a language model (LLM), including instructions and all messages from dialogue.
 */
export type LLMRequest = Readonly<{
    instructions?: string;
    messages: readonly LLMMessage[];
}>;
