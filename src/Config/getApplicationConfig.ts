import { loadConfig } from 'c12';

import type { ApplicationConfig } from '../Contracts/Config/ApplicationConfig.js';

let configCache: Promise<ApplicationConfig> | undefined = undefined;

export const getApplicationConfig = async (): Promise<ApplicationConfig> => {
    if (configCache !== undefined) {
        return configCache;
    }

    configCache = loadConfig<ApplicationConfig>({
        configFile: '.config/storyteller.json',
        configFileRequired: true,
        dotenv: true,
        packageJson: false,
        rcFile: false,
    }).then(({ config }) => config);

    return configCache;
};
