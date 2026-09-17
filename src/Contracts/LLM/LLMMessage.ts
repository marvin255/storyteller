/**
 * Represents the role of a message in a conversation with a language model (LLM).
 */
export type LLMMessageRole = 'user' | 'assistant';

/**
 * Represents a message in a conversation with a language model (LLM).
 */
export type LLMMessage<Role extends LLMMessageRole = LLMMessageRole> = Readonly<{
    role: Role;
    text: string;
}>;
