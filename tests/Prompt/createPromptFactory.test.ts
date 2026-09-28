import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { ApplicationConfig } from '../../src/Contracts/Config/ApplicationConfig.js';
import type { PromptFactory } from '../../src/Contracts/Prompt/PropmptFactory.js';
import { createLocale, type Locale } from '../../src/Contracts/Shared/Locale.js';
import type { PromptFactoryAdapter } from '../../src/Prompt/PromptFactoryAdapter.js';

const liquid = { name: 'liquid' };
const adapter = {
    doesTemplateExist: jest.fn<PromptFactoryAdapter['doesTemplateExist']>(),
    render: jest.fn<PromptFactoryAdapter['render']>(),
};
const promptFactory = {
    createPrompt: jest.fn<PromptFactory['createPrompt']>(),
};
const Liquid = jest.fn((_options: { root: string; extname: string; cache: boolean }) => liquid);
const PromptFactoryAdapterLiquidJS = jest.fn(
    (_liquid: typeof liquid, _rootFolder: string) => adapter,
);
const PromptFactoryImpl = jest.fn(
    (_adapter: typeof adapter, _defaultLocale: Locale) => promptFactory,
);

// Native ESM modules must be mocked before dynamically importing the module under test.
jest.unstable_mockModule('liquidjs', () => ({ Liquid }));
jest.unstable_mockModule('../../src/Prompt/PromptFactoryAdapterLiquidJS.js', () => ({
    PromptFactoryAdapterLiquidJS,
}));
jest.unstable_mockModule('../../src/Prompt/PromptFactoryImpl.js', () => ({ PromptFactoryImpl }));

const { createPromptFactory } = await import('../../src/Prompt/createPromptFactory.js');

// Supply only the config fields used by the factory.
const config = {
    defaultLocale: 'en-us',
    promptDirectory: '/templates/prompts',
} as ApplicationConfig;

describe('createPromptFactory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('creates a prompt factory with the configured Liquid engine and normalized locale', async () => {
        await expect(createPromptFactory(config)).resolves.toBe(promptFactory);
        expect(Liquid).toHaveBeenCalledWith({
            root: config.promptDirectory,
            extname: '.liquid',
            cache: true,
        });
        expect(PromptFactoryAdapterLiquidJS).toHaveBeenCalledWith(liquid, config.promptDirectory);
        expect(PromptFactoryImpl).toHaveBeenCalledWith(adapter, createLocale('en-US'));
    });

    test.each([
        ['Liquid engine', Liquid],
        ['adapter', PromptFactoryAdapterLiquidJS],
        ['prompt factory', PromptFactoryImpl],
    ] as const)(
        'converts synchronous %s initialization failures to promise rejections',
        async (_name, constructor) => {
            const error = new Error('Initialization failed');
            constructor.mockImplementationOnce(() => {
                throw error;
            });

            await expect(createPromptFactory(config)).rejects.toBe(error);
        },
    );

    test('rejects an invalid default locale before constructing the prompt factory', async () => {
        await expect(
            createPromptFactory({ ...config, defaultLocale: 'invalid_locale' }),
        ).rejects.toThrow("Can't cast provided data to Locale: use a valid BCP 47 locale string");
        expect(PromptFactoryImpl).not.toHaveBeenCalled();
    });
});
