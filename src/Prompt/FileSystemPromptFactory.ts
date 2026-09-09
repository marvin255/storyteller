import type { Prompt } from '../Contracts/Prompt/Prompt.js';
import type { PromptFactory } from '../Contracts/Prompt/PropmptFactory.js';
import type { Locale } from '../Contracts/Shared/Locale.js';

/**
 * This class implements the PromptFactory interface and provides a way to create prompts from the file system.
 */
export class FileSystemPromptFactory implements PromptFactory {
    /** Creates a prompt that can be sent to a language model (LLM) */
    async createPrompt(
        code: string,
        data: Record<string, unknown>,
        locale?: Locale,
    ): Promise<Prompt> {
        return Promise.resolve({
            text: `dummy prompt for code: ${code}, data: ${JSON.stringify(data)}, locale: ${String(locale)}`,
        });
    }
}
