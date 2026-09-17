import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { ApplicationConfig } from '../../src/Contracts/Config/ApplicationConfig.js';
import type { LLMClient } from '../../src/Contracts/LLM/LLMClient.js';

const modelInstance = { name: 'model instance' };
const client = { generateText: jest.fn<LLMClient['generateText']>() };
const createModel = jest.fn((_model: string) => modelInstance);
const createOpenAI = jest.fn((_settings: { apiKey?: string }) => createModel);
const createAnthropic = jest.fn((_settings: { apiKey?: string }) => createModel);
const createGoogleGenerativeAI = jest.fn((_settings: { apiKey?: string }) => createModel);
const AISDKLLMClient = jest.fn((_model: typeof modelInstance) => client);

// Mock every runtime dependency before importing the factory so no SDK implementation is loaded.
jest.unstable_mockModule('@ai-sdk/openai', () => ({ createOpenAI }));
jest.unstable_mockModule('@ai-sdk/anthropic', () => ({ createAnthropic }));
jest.unstable_mockModule('@ai-sdk/google', () => ({ createGoogleGenerativeAI }));
jest.unstable_mockModule('../../src/LLM/AISDKLLMClient.js', () => ({ AISDKLLMClient }));

const { createLLMClient } = await import('../../src/LLM/createLLMClient.js');

const config: ApplicationConfig = {
    database: undefined,
    defaultLocale: 'en-US',
    promptDirectory: '/templates/prompts',
};
const providers = [
    { provider: 'openai', createProvider: createOpenAI },
    { provider: 'anthropic', createProvider: createAnthropic },
    { provider: 'google', createProvider: createGoogleGenerativeAI },
];

describe('createLLMClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe.each(providers)('$provider', ({ provider, createProvider }) => {
        test.each([
            {
                name: 'provided',
                credentials: { apiKey: 'test-api-key' },
                settings: { apiKey: 'test-api-key' },
            },
            { name: 'omitted', credentials: {}, settings: {} },
            { name: 'empty', credentials: { apiKey: '' }, settings: {} },
        ])('creates a client with a $name API key', async ({ credentials, settings }) => {
            await expect(
                createLLMClient({
                    ...config,
                    llm: { provider, model: 'test-model', ...credentials },
                }),
            ).resolves.toBe(client);

            expect(createProvider.mock.calls).toStrictEqual([[settings]]);
            expect(createModel.mock.calls).toStrictEqual([['test-model']]);
            expect(AISDKLLMClient).toHaveBeenCalledTimes(1);
            expect(AISDKLLMClient.mock.calls[0]?.[0]).toBe(modelInstance);
            for (const other of providers) {
                if (other.provider !== provider) {
                    expect(other.createProvider).not.toHaveBeenCalled();
                }
            }
        });

        test('converts provider initialization failures to promise rejections', async () => {
            const error = new Error('Provider initialization failed');
            createProvider.mockImplementationOnce(() => {
                throw error;
            });

            await expect(
                createLLMClient({ ...config, llm: { provider, model: 'test-model' } }),
            ).rejects.toBe(error);
            expect(createModel).not.toHaveBeenCalled();
            expect(AISDKLLMClient).not.toHaveBeenCalled();
        });

        test('converts model initialization failures to promise rejections', async () => {
            const error = new Error('Model initialization failed');
            createModel.mockImplementationOnce(() => {
                throw error;
            });

            await expect(
                createLLMClient({ ...config, llm: { provider, model: 'test-model' } }),
            ).rejects.toBe(error);
            expect(AISDKLLMClient).not.toHaveBeenCalled();
        });

        test('converts client initialization failures to promise rejections', async () => {
            const error = new Error('Client initialization failed');
            AISDKLLMClient.mockImplementationOnce(() => {
                throw error;
            });

            await expect(
                createLLMClient({ ...config, llm: { provider, model: 'test-model' } }),
            ).rejects.toBe(error);
        });
    });

    test('rejects missing LLM configuration before initializing dependencies', async () => {
        await expect(createLLMClient(config)).rejects.toThrow(
            'LLM configuration is missing in the application config.',
        );

        for (const { createProvider } of providers) {
            expect(createProvider).not.toHaveBeenCalled();
        }
        expect(createModel).not.toHaveBeenCalled();
        expect(AISDKLLMClient).not.toHaveBeenCalled();
    });

    test.each(['unsupported-provider', '', 'OpenAI'])(
        'rejects unsupported provider %j before initializing dependencies',
        async (provider) => {
            await expect(
                createLLMClient({ ...config, llm: { provider, model: 'test-model' } }),
            ).rejects.toThrow(`Unsupported LLM provider: ${provider}`);

            for (const { createProvider } of providers) {
                expect(createProvider).not.toHaveBeenCalled();
            }
            expect(createModel).not.toHaveBeenCalled();
            expect(AISDKLLMClient).not.toHaveBeenCalled();
        },
    );
});
