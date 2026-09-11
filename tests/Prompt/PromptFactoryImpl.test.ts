import { describe, expect, jest, test } from '@jest/globals';

import { createLocale } from '../../src/Contracts/Shared/Locale.js';
import type { PromptFactoryAdapter } from '../../src/Prompt/PromptFactoryAdapter.js';
import { PromptFactoryImpl } from '../../src/Prompt/PromptFactoryImpl.js';

const createFactory = (defaultLocale = 'en-US') => {
    const adapter = {
        doesTemplateExist: jest
            .fn<PromptFactoryAdapter['doesTemplateExist']>()
            .mockResolvedValue(false),
        render: jest.fn<PromptFactoryAdapter['render']>().mockResolvedValue('Rendered prompt'),
    } satisfies PromptFactoryAdapter;

    return {
        adapter,
        factory: new PromptFactoryImpl(adapter, createLocale(defaultLocale)),
    };
};

describe('PromptFactoryImpl', () => {
    test('renders the selected template with the original data and returns its text', async () => {
        const { adapter, factory } = createFactory();
        const data = { name: 'Ada', story: { title: 'An adventure' } };
        adapter.doesTemplateExist.mockResolvedValue(true);
        adapter.render.mockResolvedValue('Hello, Ada!');

        await expect(factory.createPrompt('greeting', data)).resolves.toEqual({
            text: 'Hello, Ada!',
        });

        expect(adapter.render).toHaveBeenCalledTimes(1);
        expect(adapter.render).toHaveBeenCalledWith('en_US/greeting', data);
        expect(adapter.render.mock.calls[0]?.[1]).toBe(data);
    });

    test('preserves empty rendered output', async () => {
        const { adapter, factory } = createFactory();
        adapter.doesTemplateExist.mockResolvedValue(true);
        adapter.render.mockResolvedValue('');

        await expect(factory.createPrompt('greeting', {})).resolves.toEqual({ text: '' });
    });

    describe('locale fallback', () => {
        test.each([
            {
                name: 'prefers the requested region over all fallbacks',
                locale: 'cs-CZ',
                defaultLocale: 'en-US',
                available: ['cs_CZ/greeting', 'cs/greeting', 'en_US/greeting', 'en/greeting'],
                checked: ['cs_CZ/greeting'],
                selected: 'cs_CZ/greeting',
            },
            {
                name: 'falls back to the requested language before the default locale',
                locale: 'cs-CZ',
                defaultLocale: 'en-US',
                available: ['cs/greeting', 'en_US/greeting', 'en/greeting'],
                checked: ['cs_CZ/greeting', 'cs/greeting'],
                selected: 'cs/greeting',
            },
            {
                name: 'falls back to the default region before the default language',
                locale: 'cs-CZ',
                defaultLocale: 'en-US',
                available: ['en_US/greeting', 'en/greeting'],
                checked: ['cs_CZ/greeting', 'cs/greeting', 'en_US/greeting'],
                selected: 'en_US/greeting',
            },
            {
                name: 'falls back to the default language last',
                locale: 'cs-CZ',
                defaultLocale: 'en-US',
                available: ['en/greeting'],
                checked: ['cs_CZ/greeting', 'cs/greeting', 'en_US/greeting', 'en/greeting'],
                selected: 'en/greeting',
            },
            {
                name: 'uses the default region when no locale is requested',
                locale: undefined,
                defaultLocale: 'en-US',
                available: ['en_US/greeting', 'en/greeting'],
                checked: ['en_US/greeting'],
                selected: 'en_US/greeting',
            },
            {
                name: 'falls back to the default language when no locale is requested',
                locale: undefined,
                defaultLocale: 'en-US',
                available: ['en/greeting'],
                checked: ['en_US/greeting', 'en/greeting'],
                selected: 'en/greeting',
            },
            {
                name: 'supports a requested locale without a region',
                locale: 'cs',
                defaultLocale: 'en-US',
                available: ['cs/greeting', 'en_US/greeting'],
                checked: ['cs/greeting'],
                selected: 'cs/greeting',
            },
            {
                name: 'supports a default locale without a region',
                locale: 'cs',
                defaultLocale: 'en',
                available: ['en/greeting'],
                checked: ['cs/greeting', 'en/greeting'],
                selected: 'en/greeting',
            },
            {
                name: 'uses a language-only default when no locale is requested',
                locale: undefined,
                defaultLocale: 'en',
                available: ['en/greeting'],
                checked: ['en/greeting'],
                selected: 'en/greeting',
            },
            {
                name: 'intentionally ignores script subtags in the requested locale',
                locale: 'zh-Hant-TW',
                defaultLocale: 'en-US',
                available: ['zh_TW/greeting', 'zh/greeting'],
                checked: ['zh_TW/greeting'],
                selected: 'zh_TW/greeting',
            },
            {
                name: 'intentionally ignores script subtags in the default locale',
                locale: undefined,
                defaultLocale: 'zh-Hant-TW',
                available: ['zh/greeting'],
                checked: ['zh_TW/greeting', 'zh/greeting'],
                selected: 'zh/greeting',
            },
        ])('$name', async ({ locale, defaultLocale, available, checked, selected }) => {
            const { adapter, factory } = createFactory(defaultLocale);
            adapter.doesTemplateExist.mockImplementation((name) =>
                Promise.resolve(available.includes(name)),
            );

            await expect(
                factory.createPrompt(
                    'greeting',
                    {},
                    locale === undefined ? undefined : createLocale(locale),
                ),
            ).resolves.toEqual({ text: 'Rendered prompt' });

            expect(adapter.doesTemplateExist.mock.calls).toEqual(checked.map((name) => [name]));
            expect(adapter.render).toHaveBeenCalledTimes(1);
            expect(adapter.render).toHaveBeenCalledWith(selected, {});
        });
    });

    describe('code validation', () => {
        test.each(['greeting', 'story_2', 'a0_z9', '_'])(
            'accepts the valid code %j',
            async (code) => {
                const { adapter, factory } = createFactory();
                adapter.doesTemplateExist.mockResolvedValue(true);

                await expect(factory.createPrompt(code, {})).resolves.toEqual({
                    text: 'Rendered prompt',
                });

                expect(adapter.render).toHaveBeenCalledWith(`en_US/${code}`, {});
            },
        );

        test.each(['', ' ', '\t', '\n'])(
            'rejects an empty or whitespace-only code %j',
            async (code) => {
                const { adapter, factory } = createFactory();

                await expect(factory.createPrompt(code, {})).rejects.toThrow(
                    'Prompt code is empty or not a string',
                );

                expect(adapter.doesTemplateExist).not.toHaveBeenCalled();
                expect(adapter.render).not.toHaveBeenCalled();
            },
        );

        test.each([null, undefined, 123, true, {}, []])(
            'rejects a non-string code %j',
            async (code) => {
                const { adapter, factory } = createFactory();

                // @ts-expect-error Exercise runtime validation for callers outside TypeScript.
                await expect(factory.createPrompt(code, {})).rejects.toThrow(
                    'Prompt code is empty or not a string',
                );

                expect(adapter.doesTemplateExist).not.toHaveBeenCalled();
                expect(adapter.render).not.toHaveBeenCalled();
            },
        );

        test.each([
            'Greeting',
            'greeting!',
            'story-name',
            'story name',
            ' greeting',
            'greeting ',
            '../greeting',
            'nested/greeting',
            'příběh',
        ])('rejects invalid characters in code %j', async (code) => {
            const { adapter, factory } = createFactory();

            await expect(factory.createPrompt(code, {})).rejects.toThrow(
                'Prompt code contains invalid characters: only lowercase alphanumeric characters and underscores',
            );

            expect(adapter.doesTemplateExist).not.toHaveBeenCalled();
            expect(adapter.render).not.toHaveBeenCalled();
        });
    });

    test.each([
        {
            locale: 'cs-CZ',
            checked: ['cs_CZ/greeting', 'cs/greeting', 'en_US/greeting', 'en/greeting'],
        },
        { locale: undefined, checked: ['en_US/greeting', 'en/greeting'] },
    ])('rejects when no template exists for locale $locale', async ({ locale, checked }) => {
        const { adapter, factory } = createFactory();

        await expect(
            factory.createPrompt(
                'greeting',
                {},
                locale === undefined ? undefined : createLocale(locale),
            ),
        ).rejects.toThrow(
            `Prompt with code "greeting" not found for locale "${locale ?? 'default'}"`,
        );

        expect(adapter.doesTemplateExist.mock.calls).toEqual(checked.map((name) => [name]));
        expect(adapter.render).not.toHaveBeenCalled();
    });

    test('propagates lookup errors without trying another template or rendering', async () => {
        const { adapter, factory } = createFactory();
        const error = new Error('Template lookup failed');
        adapter.doesTemplateExist.mockRejectedValueOnce(error);

        await expect(factory.createPrompt('greeting', {})).rejects.toBe(error);

        expect(adapter.doesTemplateExist).toHaveBeenCalledTimes(1);
        expect(adapter.render).not.toHaveBeenCalled();
    });

    test('propagates rendering errors without trying another template', async () => {
        const { adapter, factory } = createFactory();
        const error = new Error('Template rendering failed');
        adapter.doesTemplateExist.mockResolvedValue(true);
        adapter.render.mockRejectedValueOnce(error);

        await expect(factory.createPrompt('greeting', {})).rejects.toBe(error);

        expect(adapter.doesTemplateExist).toHaveBeenCalledTimes(1);
        expect(adapter.render).toHaveBeenCalledTimes(1);
    });
});
