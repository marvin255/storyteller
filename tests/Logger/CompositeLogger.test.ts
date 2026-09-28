import { describe, expect, jest, test } from '@jest/globals';

import type { Logger } from '../../src/Contracts/Logger/Logger.js';
import { CompositeLogger } from '../../src/Logger/CompositeLogger.js';

const createLogger = () =>
    ({
        debug: jest.fn<Logger['debug']>(),
        info: jest.fn<Logger['info']>(),
        warn: jest.fn<Logger['warn']>(),
        error: jest.fn<Logger['error']>(),
        child: jest.fn<Logger['child']>(),
    }) satisfies Logger;

const levels = ['debug', 'info', 'warn', 'error'] as const;

describe('CompositeLogger', () => {
    describe.each(['debug', 'info', 'warn'] as const)('%s', (level) => {
        test('forwards the message and original context to every logger once', () => {
            const loggers = [createLogger(), createLogger()];
            const logger = new CompositeLogger(loggers);
            const context = { requestId: 'request-1', metadata: { attempt: 2 } };

            logger[level]('A log message', context);

            for (const delegate of loggers) {
                expect(delegate[level].mock.calls).toEqual([['A log message', context]]);
                expect(delegate[level].mock.calls[0]?.[1]).toBe(context);
                for (const otherLevel of levels.filter((other) => other !== level)) {
                    expect(delegate[otherLevel]).not.toHaveBeenCalled();
                }
            }
        });

        test('supports an omitted context and an empty message', () => {
            const delegate = createLogger();

            new CompositeLogger([delegate])[level]('');

            expect(delegate[level].mock.calls).toEqual([['', undefined]]);
        });
    });

    describe('error', () => {
        test.each([new Error('Something failed'), { code: 'FAILED' }, 'failure', null, 0])(
            'forwards the original error %j and context to every logger once',
            (error) => {
                const loggers = [createLogger(), createLogger()];
                const context = { requestId: 'request-1' };

                new CompositeLogger(loggers).error('Operation failed', error, context);

                for (const delegate of loggers) {
                    expect(delegate.error.mock.calls).toEqual([
                        ['Operation failed', error, context],
                    ]);
                    expect(delegate.error.mock.calls[0]?.[1]).toBe(error);
                    expect(delegate.error.mock.calls[0]?.[2]).toBe(context);
                    expect(delegate.debug).not.toHaveBeenCalled();
                    expect(delegate.info).not.toHaveBeenCalled();
                    expect(delegate.warn).not.toHaveBeenCalled();
                }
            },
        );

        test('supports omitted error and context', () => {
            const delegate = createLogger();

            new CompositeLogger([delegate]).error('Operation failed');

            expect(delegate.error.mock.calls).toEqual([['Operation failed', undefined, undefined]]);
        });

        test('supports context without an error', () => {
            const delegate = createLogger();
            const context = { requestId: 'request-1' };

            new CompositeLogger([delegate]).error('Operation failed', undefined, context);

            expect(delegate.error.mock.calls).toEqual([['Operation failed', undefined, context]]);
        });
    });

    test.each(levels)('%s propagates delegate failures and stops dispatching', (level) => {
        const first = createLogger();
        const second = createLogger();
        const error = new Error('Logger failed');
        first[level].mockImplementation(() => {
            throw error;
        });

        expect(() => {
            new CompositeLogger([first, second])[level]('A log message');
        }).toThrow(error);

        expect(first[level]).toHaveBeenCalledTimes(1);
        expect(second[level]).not.toHaveBeenCalled();
    });

    test('creates a composite of child loggers using the original context', () => {
        const children = [createLogger(), createLogger()];
        const parents = children.map((child) => {
            const parent = createLogger();
            parent.child.mockReturnValue(child);
            return parent;
        });
        const logger = new CompositeLogger(parents);
        const context = { component: 'storyteller' };

        const child = logger.child(context);

        expect(child).toBeInstanceOf(CompositeLogger);
        expect(child).not.toBe(logger);
        for (const parent of parents) {
            expect(parent.child.mock.calls).toEqual([[context]]);
            expect(parent.child.mock.calls[0]?.[0]).toBe(context);
        }

        for (const level of levels) {
            child[level]('Child message');

            for (const delegate of children) {
                expect(delegate[level]).toHaveBeenCalledTimes(1);
                expect(delegate[level].mock.calls[0]?.[0]).toBe('Child message');
            }
            for (const parent of parents) {
                expect(parent[level]).not.toHaveBeenCalled();
            }
        }
    });

    test('propagates child creation failures and stops creating children', () => {
        const first = createLogger();
        const second = createLogger();
        const error = new Error('Child creation failed');
        first.child.mockImplementation(() => {
            throw error;
        });

        expect(() => new CompositeLogger([first, second]).child({})).toThrow(error);

        expect(second.child).not.toHaveBeenCalled();
    });

    test('supports logging and creating children without delegates', () => {
        const logger = new CompositeLogger([]);
        const child = logger.child({ component: 'storyteller' });

        expect(child).toBeInstanceOf(CompositeLogger);
        expect(child).not.toBe(logger);
        for (const level of levels) {
            expect(() => {
                logger[level]('A log message');
            }).not.toThrow();
            expect(() => {
                child[level]('A child message');
            }).not.toThrow();
        }
    });
});
