import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { ApplicationConfig } from '../../src/Contracts/Config/ApplicationConfig.js';
import type { Logger } from '../../src/Contracts/Logger/Logger.js';

const delegate = { name: 'logger delegate' };
const logger = {
    debug: jest.fn<Logger['debug']>(),
    info: jest.fn<Logger['info']>(),
    warn: jest.fn<Logger['warn']>(),
    error: jest.fn<Logger['error']>(),
    child: jest.fn<Logger['child']>(),
};
const pino = jest.fn((_options: { level?: string }) => delegate);
const CompositeLogger = jest.fn((_loggers: (typeof delegate)[]) => logger);

// Mock every runtime dependency before importing the factory so no logger implementation is loaded.
jest.unstable_mockModule('pino', () => ({ default: pino }));
jest.unstable_mockModule('../../src/Logger/CompositeLogger.js', () => ({ CompositeLogger }));

const { createLogger } = await import('../../src/Logger/createLogger.js');

// Each test supplies only the logging settings used by the factory.
const config = {} as ApplicationConfig;

describe('createLogger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        { name: 'omitted logging settings', settings: {}, options: {} },
        { name: 'omitted minimum level', settings: { logging: {} }, options: {} },
        { name: 'empty minimum level', settings: { logging: { minLevel: '' } }, options: {} },
        ...['debug', 'info', 'warn', 'error'].map((level) => ({
            name: `${level} minimum level`,
            settings: { logging: { minLevel: level } },
            options: { level },
        })),
    ])('creates a composite logger with $name', async ({ settings, options }) => {
        await expect(createLogger({ ...config, ...settings })).resolves.toBe(logger);

        expect(pino.mock.calls).toStrictEqual([[options]]);
        expect(CompositeLogger.mock.calls).toStrictEqual([[[delegate]]]);
        expect(CompositeLogger.mock.calls[0]?.[0][0]).toBe(delegate);
    });

    test('converts Pino initialization failures to promise rejections', async () => {
        const error = new Error('Pino initialization failed');
        pino.mockImplementationOnce(() => {
            throw error;
        });

        await expect(createLogger(config)).rejects.toBe(error);
        expect(CompositeLogger).not.toHaveBeenCalled();
    });

    test('converts composite logger initialization failures to promise rejections', async () => {
        const error = new Error('Composite logger initialization failed');
        CompositeLogger.mockImplementationOnce(() => {
            throw error;
        });

        await expect(createLogger(config)).rejects.toBe(error);
    });
});
