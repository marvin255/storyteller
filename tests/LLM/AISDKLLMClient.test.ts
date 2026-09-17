import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { generateText as generateSDKText } from 'ai';

import type { LLMRequest } from '../../src/Contracts/LLM/LLMRequest.js';

// Only the SDK input and the response field consumed by the client are needed.
const generateText =
    jest.fn<(_options: Parameters<typeof generateSDKText>[0]) => Promise<{ text: string }>>();

// Native ESM modules must be mocked before dynamically importing the module under test.
jest.unstable_mockModule('ai', () => ({ generateText }));

const { AISDKLLMClient } = await import('../../src/LLM/AISDKLLMClient.js');

const model = 'test/model';

describe('AISDKLLMClient', () => {
    beforeEach(() => {
        generateText.mockReset();
        generateText.mockResolvedValue({ text: 'The story continues.' });
    });

    test('passes the configured model, instructions, and ordered conversation to the SDK', async () => {
        const request: LLMRequest = Object.freeze({
            instructions: '  Continue the story.\n',
            messages: Object.freeze([
                Object.freeze({ role: 'user', text: 'Start a story.' }),
                Object.freeze({ role: 'assistant', text: 'Once upon a time...' }),
                Object.freeze({ role: 'user', text: '  What happened next?\n' }),
            ] as const),
        });

        await new AISDKLLMClient(model).generateText(request);

        expect(generateText.mock.calls).toStrictEqual([
            [
                {
                    model,
                    instructions: '  Continue the story.\n',
                    messages: [
                        { role: 'user', content: 'Start a story.' },
                        { role: 'assistant', content: 'Once upon a time...' },
                        { role: 'user', content: '  What happened next?\n' },
                    ],
                },
            ],
        ]);
    });

    test.each([
        ['omitted', {}],
        ['empty', { instructions: '' }],
    ] as const)('omits %s instructions from the SDK options', async (_name, instructions) => {
        await new AISDKLLMClient(model).generateText({
            ...instructions,
            messages: [{ role: 'user', text: 'Hello!' }],
        });

        expect(generateText.mock.calls).toStrictEqual([
            [{ model, messages: [{ role: 'user', content: 'Hello!' }] }],
        ]);
    });

    test('passes an empty conversation to the SDK', async () => {
        await new AISDKLLMClient(model).generateText({ messages: [] });

        expect(generateText.mock.calls).toStrictEqual([[{ model, messages: [] }]]);
    });

    test.each(['The story continues.', '', '  A new chapter.\n'])(
        'returns SDK text %j unchanged as an assistant message',
        async (text) => {
            generateText.mockResolvedValue({ text });

            await expect(
                new AISDKLLMClient(model).generateText({
                    messages: [{ role: 'user', text: 'Continue.' }],
                }),
            ).resolves.toStrictEqual({ message: { role: 'assistant', text } });
        },
    );

    test('propagates SDK rejections', async () => {
        const error = new Error('Provider unavailable');
        generateText.mockRejectedValue(error);

        await expect(new AISDKLLMClient(model).generateText({ messages: [] })).rejects.toBe(error);
        expect(generateText).toHaveBeenCalledTimes(1);
    });

    test('converts synchronous SDK failures to promise rejections', async () => {
        const error = new Error('Invalid model');
        generateText.mockImplementation(() => {
            throw error;
        });

        await expect(new AISDKLLMClient(model).generateText({ messages: [] })).rejects.toBe(error);
        expect(generateText).toHaveBeenCalledTimes(1);
    });
});
