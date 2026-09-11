import { Liquid } from 'liquidjs';

import type { ApplicationConfig } from '../Contracts/Config/ApplicationConfig.js';
import type { PromptFactory } from '../Contracts/Prompt/PropmptFactory.js';
import { createLocale } from '../Contracts/Shared/Locale.js';
import { PromptFactoryAdapterLiquidJS } from './PromptFactoryAdapterLiquidJS.js';
import { PromptFactoryImpl } from './PromptFactoryImpl.js';

/** Creates a PromptFactory instance based on the provided application configuration. */
export const createPromptFactory = async (config: ApplicationConfig): Promise<PromptFactory> => {
    const liquid = new Liquid({
        root: config.promptDirectory,
        extname: '.liquid',
        cache: true,
    });
    const adapter = new PromptFactoryAdapterLiquidJS(liquid, config.promptDirectory);
    const propmtFactory = new PromptFactoryImpl(adapter, createLocale(config.defaultLocale));

    return Promise.resolve(propmtFactory);
};
