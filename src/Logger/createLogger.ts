import pino, { type Logger as Pino } from 'pino';

import type { ApplicationConfig } from '../Contracts/Config/ApplicationConfig.js';
import type { Logger } from '../Contracts/Logger/Logger.js';
import { CompositeLogger } from './CompositeLogger.js';

/** Factory function to create a Pino logger based on the provided configuration. */
const createPinoLogger = (config: ApplicationConfig): Pino => {
    let pinoConfig: pino.LoggerOptions = {};
    if (config.logging?.minLevel) {
        pinoConfig.level = config.logging.minLevel;
    }
    return pino(pinoConfig);
};

/** Factory function to create an array of loggers based on the provided configuration. */
const createLoggers = async (config: ApplicationConfig): Promise<Logger[]> => {
    const loggers: Logger[] = [];
    loggers.push(createPinoLogger(config));
    return Promise.resolve(loggers);
};

/** Factory function to create a composite logger that aggregates multiple loggers. */
export const createLogger = async (config: ApplicationConfig): Promise<Logger> => {
    const loggers: Logger[] = await createLoggers(config);
    const compositeLogger: Logger = new CompositeLogger(loggers);
    return Promise.resolve(compositeLogger);
};
