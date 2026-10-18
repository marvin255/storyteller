import { describe, expect, jest, test } from '@jest/globals';

import type { Logger } from '../../../../src/Contracts/Logger/Logger.js';
import { createId } from '../../../../src/Contracts/Shared/Id.js';
import { PipelineLoggerWrapper } from '../../../../src/Engine/Pipeline/PipelineLoggerWrapper.js';

const createLogger = () =>
    ({
        debug: jest.fn<Logger['debug']>(),
        info: jest.fn<Logger['info']>(),
        warn: jest.fn<Logger['warn']>(),
        error: jest.fn<Logger['error']>(),
        child: jest.fn<Logger['child']>(),
    }) satisfies Logger;

describe('PipelineLoggerWrapper', () => {
    test('lazily creates and reuses a logger with pipeline context', () => {
        const original = createLogger();
        const runLogger = createLogger();
        original.child.mockReturnValue(runLogger);
        const wrapper = new PipelineLoggerWrapper(original);
        const logger: Logger = wrapper;

        expect(original.child).not.toHaveBeenCalled();
        logger.info('First message');
        logger.info('Second message');

        expect(runLogger.info.mock.calls).toEqual([
            ['First message', undefined],
            ['Second message', undefined],
        ]);
        expect(original.child.mock.calls).toEqual([
            [{ source: 'PipelineEngine', runId: expect.stringMatching(/^[0-9a-f-]{36}$/u) }],
        ]);
    });

    test.each(['debug', 'info', 'warn'] as const)(
        '%s forwards messages and optional context to the current logger',
        (level) => {
            const original = createLogger();
            const runLogger = createLogger();
            const extendedLogger = createLogger();
            original.child.mockReturnValue(runLogger);
            runLogger.child.mockReturnValue(extendedLogger);
            const wrapper = new PipelineLoggerWrapper(original);
            const context = { attempt: 2 };

            wrapper[level]('Initial message', context);
            wrapper.extendLoggerWithContext({ storyId: 42 });
            wrapper[level]('Extended message', context);
            wrapper[level]('Without context');

            expect(runLogger[level].mock.calls).toEqual([['Initial message', context]]);
            expect(runLogger[level].mock.calls[0]?.[1]).toBe(context);
            expect(extendedLogger[level].mock.calls).toEqual([
                ['Extended message', context],
                ['Without context', undefined],
            ]);
            expect(extendedLogger[level].mock.calls[0]?.[1]).toBe(context);
            expect(original[level]).not.toHaveBeenCalled();
        },
    );

    test('forwards errors and optional arguments to the current logger', () => {
        const original = createLogger();
        const runLogger = createLogger();
        const extendedLogger = createLogger();
        original.child.mockReturnValue(runLogger);
        runLogger.child.mockReturnValue(extendedLogger);
        const wrapper = new PipelineLoggerWrapper(original);
        const error = new Error('Operation failed');
        const context = { attempt: 2 };

        wrapper.error('Initial error', error, context);
        wrapper.extendLoggerWithContext({ storyId: 42 });
        wrapper.error('Extended error', error, context);
        wrapper.error('Without context', error);
        wrapper.error('Without error', undefined, context);
        wrapper.error('Without arguments');

        expect(runLogger.error.mock.calls).toEqual([['Initial error', error, context]]);
        expect(extendedLogger.error.mock.calls).toEqual([
            ['Extended error', error, context],
            ['Without context', error, undefined],
            ['Without error', undefined, context],
            ['Without arguments', undefined, undefined],
        ]);
        expect(extendedLogger.error.mock.calls[0]?.[1]).toBe(error);
        expect(extendedLogger.error.mock.calls[0]?.[2]).toBe(context);
        expect(original.error).not.toHaveBeenCalled();
    });

    test('creates children from the current logger without changing its context', () => {
        const original = createLogger();
        const runLogger = createLogger();
        const extendedLogger = createLogger();
        const operationLogger = createLogger();
        original.child.mockReturnValue(runLogger);
        runLogger.child.mockReturnValue(extendedLogger);
        extendedLogger.child.mockReturnValue(operationLogger);
        const wrapper = new PipelineLoggerWrapper(original);
        const context = { operation: 'ExampleOperation' };
        wrapper.extendLoggerWithContext({ storyId: 42 });

        const child = wrapper.child(context);
        wrapper.info('Pipeline message');
        child.info('Operation message');

        expect(child).toBe(operationLogger);
        expect(extendedLogger.child.mock.calls).toEqual([[context]]);
        expect(extendedLogger.child.mock.calls[0]?.[0]).toBe(context);
        expect(extendedLogger.info.mock.calls).toEqual([['Pipeline message', undefined]]);
        expect(operationLogger.info.mock.calls).toEqual([['Operation message', undefined]]);
        expect(original.child).toHaveBeenCalledTimes(1);
    });

    test('extends the current logger without extending the original logger', () => {
        const original = createLogger();
        const runLogger = createLogger();
        const externalLogger = createLogger();
        const storyLogger = createLogger();
        original.child.mockReturnValue(runLogger);
        runLogger.child.mockReturnValue(externalLogger);
        externalLogger.child.mockReturnValue(storyLogger);
        const wrapper = new PipelineLoggerWrapper(original);
        const externalContext = { externalId: createId('external-one') };
        const storyContext = { storyId: 42 };

        wrapper.extendLoggerWithContext(externalContext);

        wrapper.info('External context');

        expect(externalLogger.info.mock.calls).toEqual([['External context', undefined]]);
        expect(runLogger.child.mock.calls).toEqual([[externalContext]]);

        wrapper.extendLoggerWithContext(storyContext);

        wrapper.info('Story context');

        expect(storyLogger.info.mock.calls).toEqual([['Story context', undefined]]);
        expect(externalLogger.child.mock.calls).toEqual([[storyContext]]);
        expect(original.child).toHaveBeenCalledTimes(1);
        expect(storyLogger.child).not.toHaveBeenCalled();
    });

    test('resets extended context and creates a fresh run from the original logger', () => {
        const original = createLogger();
        const firstRunLogger = createLogger();
        const extendedLogger = createLogger();
        const secondRunLogger = createLogger();
        original.child.mockReturnValueOnce(firstRunLogger).mockReturnValueOnce(secondRunLogger);
        firstRunLogger.child.mockReturnValue(extendedLogger);
        const wrapper = new PipelineLoggerWrapper(original);
        wrapper.extendLoggerWithContext({ storyId: 42 });

        wrapper.resetLogger();

        expect(original.child).toHaveBeenCalledTimes(1);
        wrapper.info('New run');
        wrapper.info('Same run');

        expect(secondRunLogger.info.mock.calls).toEqual([
            ['New run', undefined],
            ['Same run', undefined],
        ]);
        expect(extendedLogger.info).not.toHaveBeenCalled();
        expect(original.child.mock.calls).toEqual([
            [{ source: 'PipelineEngine', runId: expect.stringMatching(/^[0-9a-f-]{36}$/u) }],
            [{ source: 'PipelineEngine', runId: expect.stringMatching(/^[0-9a-f-]{36}$/u) }],
        ]);
        expect(original.child.mock.calls[0]?.[0]?.['runId']).not.toBe(
            original.child.mock.calls[1]?.[0]?.['runId'],
        );
        expect(extendedLogger.child).not.toHaveBeenCalled();
    });

    test('allows resetting before initialization and more than once', () => {
        const original = createLogger();
        const runLogger = createLogger();
        original.child.mockReturnValue(runLogger);
        const wrapper = new PipelineLoggerWrapper(original);

        wrapper.resetLogger();
        wrapper.resetLogger();

        expect(original.child).not.toHaveBeenCalled();
        wrapper.info('First message');

        expect(runLogger.info.mock.calls).toEqual([['First message', undefined]]);
        expect(original.child).toHaveBeenCalledTimes(1);
    });
});
