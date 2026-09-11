/**
 * This type, which represents a prompt that can be sent to a language model (LLM).
 */
export type Prompt = Readonly<{
    /** The prompt text to be sent to LLM */
    text: string;
}>;
