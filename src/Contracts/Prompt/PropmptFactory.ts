import type { Locale } from '../Shared/Locale.js';
import type { Prompt } from './Prompt.js';

/**
 * This interface defines a factory for creating prompts that can be sent to a language model (LLM).
 */
export interface PromptFactory {
    /** Creates a prompt that can be sent to a language model (LLM) */
    createPrompt(code: string, data: Record<string, unknown>, locale?: Locale): Promise<Prompt>;
}
