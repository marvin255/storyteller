import { describe, expect, test } from '@jest/globals';

import { createLocale } from '../../src/Contracts/Shared/Locale.js';
import { FileSystemPromptFactory } from '../../src/Prompt/FileSystemPromptFactory.js';

describe('FileSystemPromptFactory', () => {
    test('includes the code, serialized data, and locale in the prompt', async () => {
        const factory = new FileSystemPromptFactory();

        await expect(
            factory.createPrompt('greeting', { name: 'Alice' }, createLocale('en-US')),
        ).resolves.toEqual({
            text: 'dummy prompt for code: greeting, data: {"name":"Alice"}, locale: en-US',
        });
    });

    test('preserves the prompt text when the optional locale is omitted', async () => {
        const factory = new FileSystemPromptFactory();

        await expect(factory.createPrompt('greeting', {})).resolves.toEqual({
            text: 'dummy prompt for code: greeting, data: {}, locale: undefined',
        });
    });
});
