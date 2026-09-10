import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
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

    describe('doesTemplateExist path containment', () => {
        let temporaryFolder: string;
        let templateFolder: string;

        beforeEach(async () => {
            temporaryFolder = await mkdtemp(path.join(tmpdir(), 'prompt-adapter-'));
            templateFolder = path.join(temporaryFolder, 'templates');
            await cp(rootFolder, templateFolder, { recursive: true });
            await cp(rootFolder, path.join(temporaryFolder, 'templates-other'), {
                recursive: true,
            });
            await cp(
                path.join(rootFolder, 'greeting.liquid'),
                path.join(temporaryFolder, 'outside.liquid'),
            );
            adapter = new PromptFactoryAdapterLiquidJS(
                new Liquid({ root: templateFolder, extname: '.liquid' }),
                templateFolder,
            );
        });

        afterEach(async () => {
            await rm(temporaryFolder, { recursive: true, force: true });
        });

        test.each(['../outside', 'nested/../../outside', '../templates-other/greeting'])(
            'rejects traversal to an existing template outside the root: %s',
            async (templateName) => {
                await expect(adapter.doesTemplateExist(templateName)).resolves.toBe(false);
            },
        );

        test('rejects absolute template names even when they point inside the root', async () => {
            await expect(
                adapter.doesTemplateExist(path.join(templateFolder, 'greeting')),
            ).resolves.toBe(false);
        });

        test('rejects traversal even when an outside symlink points back inside the root', async () => {
            await symlink(
                path.join(templateFolder, 'greeting.liquid'),
                path.join(temporaryFolder, 'templates-other', 'internal.liquid'),
            );

            await expect(adapter.doesTemplateExist('../templates-other/internal')).resolves.toBe(
                false,
            );
        });

        test('rejects a file symlink pointing outside the root', async () => {
            await symlink(
                path.join(temporaryFolder, 'outside.liquid'),
                path.join(templateFolder, 'external.liquid'),
            );

            await expect(adapter.doesTemplateExist('external')).resolves.toBe(false);
        });

        test('rejects a directory symlink pointing to a sibling with the same root prefix', async () => {
            await symlink(
                path.join(temporaryFolder, 'templates-other'),
                path.join(templateFolder, 'external'),
            );

            await expect(adapter.doesTemplateExist('external/greeting')).resolves.toBe(false);
        });

        test.each(['.', '..'])(
            'rejects a symlink pointing to the root or its parent: %s',
            async (target) => {
                await symlink(target, path.join(templateFolder, 'directory.liquid'));

                await expect(adapter.doesTemplateExist('directory')).resolves.toBe(false);
            },
        );

        test('allows a symlink pointing to a template inside the root', async () => {
            await symlink('greeting.liquid', path.join(templateFolder, 'internal.liquid'));

            await expect(adapter.doesTemplateExist('internal')).resolves.toBe(true);
        });

        test('allows template names beginning with two dots within the root', async () => {
            await cp(
                path.join(rootFolder, 'greeting.liquid'),
                path.join(templateFolder, '..greeting.liquid'),
            );

            await expect(adapter.doesTemplateExist('..greeting')).resolves.toBe(true);
        });

        test('supports a root folder that is itself a symlink', async () => {
            const linkedRoot = path.join(temporaryFolder, 'linked-root');
            await symlink(templateFolder, linkedRoot);
            adapter = new PromptFactoryAdapterLiquidJS(
                new Liquid({ root: linkedRoot, extname: '.liquid' }),
                linkedRoot,
            );

            await expect(adapter.doesTemplateExist('greeting')).resolves.toBe(true);
        });
    });
});
