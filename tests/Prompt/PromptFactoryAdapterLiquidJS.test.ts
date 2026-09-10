import { fileURLToPath, URL } from 'node:url';

import { beforeEach, describe, expect, test } from '@jest/globals';
import { Liquid } from 'liquidjs';

import { PromptFactoryAdapterLiquidJS } from '../../src/Prompt/PromptFactoryAdapterLiquidJS.js';

const rootFolder = fileURLToPath(new URL('./fixtures/', import.meta.url));

describe('PromptFactoryAdapterLiquidJS', () => {
    let adapter: PromptFactoryAdapterLiquidJS;

    beforeEach(() => {
        const templateEngine = new Liquid({
            root: rootFolder,
            extname: '.liquid',
            strictVariables: true,
        });
        adapter = new PromptFactoryAdapterLiquidJS(templateEngine, rootFolder);
    });

    describe('render', () => {
        test('renders a template using the supplied data and Liquid filters', async () => {
            await expect(adapter.render('greeting', { name: 'Ada' })).resolves.toBe(
                'Hello, ADA!\n',
            );
        });

        test('renders a template from a nested folder', async () => {
            await expect(adapter.render('nested/farewell', { name: 'Grace' })).resolves.toBe(
                'Goodbye, Grace!\n',
            );
        });

        test('preserves empty rendered output', async () => {
            await expect(adapter.render('empty', {})).resolves.toBe('');
        });

        test('rejects when the template does not exist', async () => {
            await expect(adapter.render('missing', {})).rejects.toThrow('missing');
        });

        test('propagates template parsing errors', async () => {
            await expect(adapter.render('invalid', {})).rejects.toThrow('not_a_liquid_tag');
        });

        test('propagates rendering errors from the configured Liquid instance', async () => {
            await expect(adapter.render('greeting', {})).rejects.toThrow(
                'undefined variable: name',
            );
        });
    });

    describe('doesTemplateExist', () => {
        test.each(['greeting', 'nested/farewell', 'empty', 'invalid'])(
            'returns true for the existing template %s',
            async (templateName) => {
                await expect(adapter.doesTemplateExist(templateName)).resolves.toBe(true);
            },
        );

        test.each(['missing', 'nested/missing', 'missing/greeting'])(
            'returns false for the missing template %s',
            async (templateName) => {
                await expect(adapter.doesTemplateExist(templateName)).resolves.toBe(false);
            },
        );
    });
});
