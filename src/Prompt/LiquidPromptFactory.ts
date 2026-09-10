import type { Liquid } from 'liquidjs';

import type { Prompt } from '../Contracts/Prompt/Prompt.js';
import type { PromptFactory } from '../Contracts/Prompt/PropmptFactory.js';
import { createLocale, type Locale } from '../Contracts/Shared/Locale.js';

/**
 * This class implements the PromptFactory interface and provides a way to create prompts from the file system.
 */
export class LiquidPromptFactory implements PromptFactory {
    private readonly DEFAULT_LOCALE: Locale = createLocale('en');

    constructor(private templateEngine: Liquid) {}

    /** Creates a prompt that can be sent to a language model (LLM) */
    async createPrompt(
        code: string,
        data: Record<string, unknown>,
        locale?: Locale,
    ): Promise<Prompt> {
        const fullPath = this.createFullPath(code, locale ?? this.DEFAULT_LOCALE);
        const rendered: unknown = await this.templateEngine.renderFile(fullPath, data);
        return {
            text: String(rendered),
        };
    }

    /** Validates the provided code to ensure we can safely use it as a file path */
    private validateCode(code: string): void {
        if (!code || code.trim() === '') {
            throw new Error('Code cannot be empty');
        }
        if (!/^[a-z0-9_]+$/.test(code)) {
            throw new Error('Code contains invalid characters');
        }
    }

    /** Creates the full path to the prompt template file based on the provided code and locale */
    private createFullPath(code: string, locale: Locale): string {
        this.validateCode(code);
        const language = new Intl.Locale(locale).language;
        return `${language}/${code}`;
    }
}
