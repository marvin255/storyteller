import { access } from 'node:fs/promises';
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

    /** Checks if a template with the given name exists. Use rootFolder to determine the base path for template files. */
    async doesTemplateExist(templateName: string): Promise<boolean> {
        try {
            await access(path.join(this.rootFolder, `${templateName}.liquid`));
            return true;
        } catch {
            return false;
        }
    }
}
