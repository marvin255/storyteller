import type { LLMMessage } from './LLMMessage.js';

/**
 * Represents a response from a language model (LLM).
 */
export type LLMResponse = Readonly<{
    message: LLMMessage<'assistant'>;
}>;
