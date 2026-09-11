import { realpath } from 'node:fs/promises';
import path from 'node:path';

import type { Liquid } from 'liquidjs';

import type { PromptFactoryAdapter } from './PromptFactoryAdapter.js';

/**
 * This class implements the PromptFactoryAdapter interface and provides a way to adapt a prompt factory to the LiquidJS template engine.
 */
export class PromptFactoryAdapterLiquidJS implements PromptFactoryAdapter {
    constructor(
        private templateEngine: Liquid,
        private rootFolder: string,
    ) {}

    /** Renders a template with the given name and data, returning the rendered string. Use rootFolder to determine the base path for template files. */
    async render(templateName: string, data: Record<string, unknown>): Promise<string> {
        const rendered: unknown = await this.templateEngine.renderFile(templateName, data);
        return String(rendered);
    }

    /** Checks if a template exists within rootFolder, returning false for paths or symlinks that escape it. */
    async doesTemplateExist(templateName: string): Promise<boolean> {
        if (path.isAbsolute(templateName)) {
            return false;
        }

        const rootPath = path.resolve(this.rootFolder);
        const templatePath = path.resolve(rootPath, `${templateName}.liquid`);
        if (!this.isWithinRoot(rootPath, templatePath)) {
            return false;
        }

        try {
            const realRootPath = await realpath(rootPath);
            const realTemplatePath = await realpath(templatePath);
            return this.isWithinRoot(realRootPath, realTemplatePath);
        } catch {
            return false;
        }
    }

    /** Checks containment by path segments, including when the root is a filesystem root. */
    private isWithinRoot(rootPath: string, templatePath: string): boolean {
        const relativePath = path.relative(rootPath, templatePath);
        return (
            relativePath !== '' &&
            relativePath !== '..' &&
            !relativePath.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativePath)
        );
    }
}
