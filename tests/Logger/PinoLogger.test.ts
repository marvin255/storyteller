import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { Bindings, Logger as Pino } from 'pino';

const createPino = () => {
    const delegate = {
        debug: jest.fn<Pino['debug']>(),
        info: jest.fn<Pino['info']>(),
        warn: jest.fn<Pino['warn']>(),
        error: jest.fn<Pino['error']>(),
        child: jest.fn<(bindings: Bindings) => Pino>(),
    };

    // Only the Pino methods used by the adapter are needed in this test double.
    return delegate as unknown as Pino & typeof delegate;
};

const pino = jest.fn<() => Pino>();

// Mock the default factory before importing the native ESM module under test.
jest.unstable_mockModule('pino', () => ({ default: pino }));

const { PinoLogger } = await import('../../src/Logger/PinoLogger.js');
const levels = ['debug', 'info', 'warn', 'error'] as const;

describe('PinoLogger', () => {
    beforeEach(() => {
        pino.mockReset();
    });

    test('creates and uses a default Pino logger when none is supplied', () => {
        const delegate = createPino();
        pino.mockReturnValue(delegate);

        const logger = new PinoLogger();
        logger.info('Default logger message');

        expect(pino.mock.calls).toEqual([[]]);
        expect(delegate.info.mock.calls).toEqual([[undefined, 'Default logger message']]);
    });

    test('uses an injected logger without calling the default factory', () => {
        const delegate = createPino();

        new PinoLogger(delegate).info('Injected logger message');

        expect(pino).not.toHaveBeenCalled();
        expect(delegate.info.mock.calls).toEqual([[undefined, 'Injected logger message']]);
    });

    describe.each(['debug', 'info', 'warn'] as const)('%s', (level) => {
        test('forwards the original context and message to the matching Pino method once', () => {
            const delegate = createPino();
            const context = { requestId: 'request-1', metadata: { attempt: 2 } };

            new PinoLogger(delegate)[level]('A log message', context);

            expect(delegate[level].mock.calls).toEqual([[context, 'A log message']]);
            expect(delegate[level].mock.calls[0]?.[0]).toBe(context);
            for (const otherLevel of levels.filter((other) => other !== level)) {
                expect(delegate[otherLevel]).not.toHaveBeenCalled();
            }
        });

        test('supports omitted context and an empty message', () => {
            const delegate = createPino();

            new PinoLogger(delegate)[level]('');

            expect(delegate[level].mock.calls).toEqual([[undefined, '']]);
        });
    });

    describe('error', () => {
        test.each([new Error('Something failed'), { code: 'FAILED' }, 'failure', null, 0])(
            'forwards error %j under err alongside context without modifying the context',
            (error) => {
                const delegate = createPino();
                const context = Object.freeze({ requestId: 'request-1', err: 'previous error' });

                new PinoLogger(delegate).error('Operation failed', error, context);

                expect(delegate.error.mock.calls).toEqual([
                    [{ requestId: 'request-1', err: error }, 'Operation failed'],
                ]);
                expect(delegate.error.mock.calls[0]?.[0]).toHaveProperty('err', error);
                expect(context).toEqual({ requestId: 'request-1', err: 'previous error' });
                expect(delegate.debug).not.toHaveBeenCalled();
                expect(delegate.info).not.toHaveBeenCalled();
                expect(delegate.warn).not.toHaveBeenCalled();
            },
        );

        test('supports an error without context', () => {
            const delegate = createPino();
            const error = new Error('Something failed');

            new PinoLogger(delegate).error('Operation failed', error);

            expect(delegate.error.mock.calls).toEqual([[{ err: error }, 'Operation failed']]);
        });

        test('supports omitted error and context and an empty message', () => {
            const delegate = createPino();

            new PinoLogger(delegate).error('');

            expect(delegate.error.mock.calls).toStrictEqual([[{ err: undefined }, '']]);
        });

        test('supports context without an error and overrides a context err value', () => {
            const delegate = createPino();
            const context = { requestId: 'request-1', err: 'previous error' };

            new PinoLogger(delegate).error('Operation failed', undefined, context);

            expect(delegate.error.mock.calls).toStrictEqual([
                [{ requestId: 'request-1', err: undefined }, 'Operation failed'],
            ]);
        });
    });

    test.each(levels)('%s propagates Pino failures', (level) => {
        const delegate = createPino();
        const error = new Error('Logger failed');
        delegate[level].mockImplementation(() => {
            throw error;
        });

        expect(() => {
            new PinoLogger(delegate)[level]('A log message');
        }).toThrow(error);
    });

    test('wraps the Pino child and routes child messages through it', () => {
        const parent = createPino();
        const delegate = createPino();
        parent.child.mockReturnValue(delegate);
        const logger = new PinoLogger(parent);
        const context = { component: 'storyteller' };

        const child = logger.child(context);

        expect(child).toBeInstanceOf(PinoLogger);
        expect(child).not.toBe(logger);
        expect(parent.child.mock.calls).toEqual([[context]]);
        expect(parent.child.mock.calls[0]?.[0]).toBe(context);
        expect(pino).not.toHaveBeenCalled();

        for (const level of levels) {
            child[level]('Child message');

            expect(delegate[level].mock.calls).toEqual([
                [level === 'error' ? { err: undefined } : undefined, 'Child message'],
            ]);
            expect(parent[level]).not.toHaveBeenCalled();
        }
    });

    test('propagates Pino child creation failures', () => {
        const delegate = createPino();
        const error = new Error('Child creation failed');
        delegate.child.mockImplementation(() => {
            throw error;
        });

        expect(() => new PinoLogger(delegate).child({})).toThrow(error);
    });
});
