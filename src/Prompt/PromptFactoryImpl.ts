import type { Prompt } from '../Contracts/Prompt/Prompt.js';
import type { PromptFactory } from '../Contracts/Prompt/PropmptFactory.js';
import type { Locale } from '../Contracts/Shared/Locale.js';
import type { PromptFactoryAdapter } from './PromptFactoryAdapter.js';

interface ParsedLocale {
    language: string;
    region: string | undefined;
}

/**
 * This class implements the PromptFactory interface.
 * It calculates the real prompt name based on the provided code and locale,
 * and uses the provided PromptFactoryAdapter to render the prompt.
 */
export class PromptFactoryImpl implements PromptFactory {
    private readonly defaultLocale: ParsedLocale;

    constructor(
        private adapter: PromptFactoryAdapter,
        defaultLocale: Locale,
    ) {
        this.defaultLocale = this.parseLocale(defaultLocale);
    }

    /** Creates a prompt based on the provided code, data, and optional locale. */
    async createPrompt(
        code: string,
        data: Record<string, unknown>,
        locale?: Locale,
    ): Promise<Prompt> {
        this.validateCode(code);

        const realPromptName = await this.findRealPromptName(code, locale);
        if (!realPromptName) {
            throw new Error(
                `Prompt with code "${code}" not found for locale "${locale ?? 'default'}"`,
            );
        }

        const renderedPrompt = await this.adapter.render(realPromptName, data);

        return { text: renderedPrompt };
    }

    /** Validates the prompt code to ensure it is a non-empty string containing only lowercase alphanumeric characters and underscores. */
    private validateCode(code: string): void {
        if (!code || typeof code !== 'string' || code.trim() === '') {
            throw new Error('Prompt code is empty or not a string');
        }

        if (!/^[a-z0-9_]+$/.test(code)) {
            throw new Error(
                'Prompt code contains invalid characters: only lowercase alphanumeric characters and underscores',
            );
        }
    }

    /** Parses a locale string into its language and region components. */
    private parseLocale(localeString: string): ParsedLocale {
        const locale = new Intl.Locale(localeString);

        return {
            language: locale.language,
            region: locale.region,
        };
    }

    /** Generates all possible prompt names based on the provided code and optional locale, considering the default locale as a fallback. */
    private getAllPossiblePromptNames(code: string, locale?: Locale): string[] {
        const codes: string[] = [];

        if (locale) {
            const currentLocale = this.parseLocale(locale);
            if (currentLocale.region) {
                codes.push(`${currentLocale.language}_${currentLocale.region}/${code}`);
            }
            codes.push(`${currentLocale.language}/${code}`);
        }

        if (this.defaultLocale.region) {
            codes.push(`${this.defaultLocale.language}_${this.defaultLocale.region}/${code}`);
        }

        codes.push(`${this.defaultLocale.language}/${code}`);

        return codes;
    }

    /** Finds the real prompt name by checking all possible prompt names based on the provided code and optional locale. */
    private async findRealPromptName(code: string, locale?: Locale): Promise<string | null> {
        const possiblePromptNames = this.getAllPossiblePromptNames(code, locale);

        for (const promptName of possiblePromptNames) {
            if (await this.adapter.doesTemplateExist(promptName)) {
                return promptName;
            }
        }

        return null;
    }
}
