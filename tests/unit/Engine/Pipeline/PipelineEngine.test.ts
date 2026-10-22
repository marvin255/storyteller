import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LoggedIOMessage } from '../../../../src/Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import { LoggedIOMessageRepository } from '../../../../src/Contracts/Domain/LoggedIOMessage/LoggedIOMessageRepository.js';
import type { Story } from '../../../../src/Contracts/Domain/Story/Story.js';
import { StoryRepository } from '../../../../src/Contracts/Domain/Story/StoryRepository.js';
import type { IOChannelSender } from '../../../../src/Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../../../../src/Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../../../src/Contracts/IOChannel/IOMessageOutbound.js';
import type { EntityManager } from '../../../../src/Contracts/Persistence/EntityManager.js';
import type { RepositoryToken } from '../../../../src/Contracts/Persistence/RepositoryToken.js';
import { createId } from '../../../../src/Contracts/Shared/Id.js';
import type { PipelineOperation } from '../../../../src/Engine/Pipeline/PipelineOperation.js';
import type { PipelineOperationResult } from '../../../../src/Engine/Pipeline/PipelineOperationResult.js';
import type { sanitizeMessageArray as SanitizeMessageArray } from '../../../../src/Engine/sanitizeMessageArray.js';
import { createTestLogger } from '../../../helper/Logger/createTestLogger.js';

const sanitizeMessageArray = jest.fn<typeof SanitizeMessageArray>();
jest.unstable_mockModule('../../../../src/Engine/sanitizeMessageArray.js', () => ({
    sanitizeMessageArray,
}));

const { PipelineEngine } = await import('../../../../src/Engine/Pipeline/PipelineEngine.js');

const createMessage = (name = 'one'): IOMessageInbound => ({
    type: 'inbound',
    messageId: createId(`message-${name}`),
    externalId: createId('external-one'),
    userId: createId('user-one'),
    content: `Input ${name}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
});

const createLoggedMessage = (overrides: Partial<LoggedIOMessage> = {}): LoggedIOMessage => ({
    ...createMessage(),
    id: 1,
    storyId: null,
    isHandled: false,
    ...overrides,
});

const createOperation = (result: PipelineOperationResult = { stopProcessing: false }) => ({
    run: jest.fn<PipelineOperation['run']>().mockResolvedValue(result),
});

const createRepositories = (story: Story) => ({
    messages: {
        persistIOMessages: jest
            .fn<LoggedIOMessageRepository['persistIOMessages']>()
            .mockResolvedValue([]),
        markAllHandled: jest
            .fn<LoggedIOMessageRepository['markAllHandled']>()
            .mockResolvedValue(undefined),
    },
    stories: {
        findOrCreateActiveStoryForExternalId: jest
            .fn<StoryRepository['findOrCreateActiveStoryForExternalId']>()
            .mockResolvedValue(story),
        save: jest.fn<StoryRepository['save']>().mockResolvedValue(undefined),
    },
});

const createRepositoryGetter = (repositories: ReturnType<typeof createRepositories>) =>
    jest.fn(<T>(token: RepositoryToken<T>): Promise<T> => {
        const byToken = new Map<symbol, unknown>([
            [LoggedIOMessageRepository, repositories.messages],
            [StoryRepository, repositories.stories],
        ]);
        if (!byToken.has(token)) {
            throw new Error(`Unexpected repository: ${String(token)}`);
        }
        return Promise.resolve(byToken.get(token) as T);
    });

const createHarness = (operations = [createOperation()]) => {
    const input = createMessage();
    const incoming = [createLoggedMessage()];
    const story: Story = { id: 42, externalId: input.externalId, status: 'new' };
    const repositories = createRepositories(story);
    const transactionRepositories = createRepositories(story);
    const getRepository = createRepositoryGetter(repositories);
    const transactionGetRepository = createRepositoryGetter(transactionRepositories);
    const transactionManager: EntityManager = {
        getRepository: transactionGetRepository as EntityManager['getRepository'],
        runInTransaction: jest.fn<
            EntityManager['runInTransaction']
        >() as EntityManager['runInTransaction'],
        close: jest.fn<EntityManager['close']>(),
    };
    const runInTransaction = jest.fn(async <T>(action: (em: EntityManager) => Promise<T>) =>
        action(transactionManager),
    );
    const entityManager: EntityManager = {
        getRepository: getRepository as EntityManager['getRepository'],
        runInTransaction: runInTransaction as EntityManager['runInTransaction'],
        close: jest.fn<EntityManager['close']>(),
    };
    const send = jest.fn<IOChannelSender['send']>().mockResolvedValue(undefined);
    const logger = createTestLogger();
    const engine = new PipelineEngine(operations, entityManager, { send }, logger);
    sanitizeMessageArray.mockReturnValue([input]);
    repositories.messages.persistIOMessages.mockResolvedValue(incoming);

    return {
        engine,
        operations,
        input,
        incoming,
        story,
        repositories,
        transactionRepositories,
        getRepository,
        transactionGetRepository,
        transactionManager,
        runInTransaction,
        entityManager,
        send,
        logger,
    };
};

describe('PipelineEngine', () => {
    beforeEach(() => {
        sanitizeMessageArray.mockReset();
    });

    describe('constructor', () => {
        test('requires at least one operation', () => {
            const { entityManager, send, logger } = createHarness();

            expect(() => new PipelineEngine([], entityManager, { send }, logger)).toThrow(
                'PipelineEngine requires at least one operation to function.',
            );
        });
    });

    describe('handle', () => {
        test.each([false, true])(
            'passes the input to the sanitizer and persists only its result (batch: %p)',
            async (batch) => {
                const h = createHarness();
                const input = batch ? [createMessage('two'), h.input] : h.input;
                const sanitized = [createMessage('sanitized')];
                sanitizeMessageArray.mockReturnValue(sanitized);

                await h.engine.handle(input);

                expect(sanitizeMessageArray).toHaveBeenCalledTimes(1);
                expect(sanitizeMessageArray).toHaveBeenCalledWith(input, h.logger);
                expect(h.repositories.messages.persistIOMessages).toHaveBeenCalledTimes(1);
                expect(h.repositories.messages.persistIOMessages).toHaveBeenCalledWith(sanitized);
                expect(
                    h.repositories.stories.findOrCreateActiveStoryForExternalId,
                ).toHaveBeenCalledTimes(1);
                expect(
                    h.repositories.stories.findOrCreateActiveStoryForExternalId,
                ).toHaveBeenCalledWith(h.input.externalId);
                expect(h.operations[0]?.run).toHaveBeenCalledTimes(1);
                expect(h.operations[0]?.run).toHaveBeenCalledWith({
                    story: h.story,
                    messages: h.incoming,
                    logger: h.logger,
                });
            },
        );

        test('logs processing and operation results with accumulated child context', async () => {
            const operation = createOperation();
            const h = createHarness([operation]);

            await h.engine.handle(h.input);

            const context = {
                source: 'PipelineEngine',
                runId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                externalId: h.input.externalId,
                storyId: h.story.id,
            };
            const operationContext = { story: h.story, messages: h.incoming, logger: h.logger };
            const pipelineResult = { newMessages: [], updatedStory: h.story };
            expect(h.logger.getEntries()).toEqual([
                {
                    level: 'info',
                    message: 'Start message processing',
                    context: { ...context, messages: h.incoming },
                },
                {
                    level: 'info',
                    message: 'Operation started',
                    context: { ...context, operation: 'Object', context: operationContext },
                },
                {
                    level: 'info',
                    message: 'Operation completed',
                    context: {
                        ...context,
                        operation: 'Object',
                        context: operationContext,
                        result: { stopProcessing: false },
                    },
                },
                {
                    level: 'info',
                    message: 'Message processing completed',
                    context: { ...context, operation: 'Object', pipelineResult },
                },
            ]);
        });

        test.each([
            { name: 'no persisted messages', messages: [] },
            {
                name: 'already handled inbound messages',
                messages: [createLoggedMessage({ isHandled: true })],
            },
            { name: 'outbound messages', messages: [createLoggedMessage({ type: 'outbound' })] },
            {
                name: 'already handled outbound messages',
                messages: [createLoggedMessage({ type: 'outbound', isHandled: true })],
            },
        ])('stops when there are $name', async ({ messages }) => {
            const h = createHarness();
            sanitizeMessageArray.mockReturnValue([]);
            h.repositories.messages.persistIOMessages.mockResolvedValue(messages);

            await h.engine.handle([]);

            expect(h.repositories.messages.persistIOMessages).toHaveBeenCalledTimes(1);
            expect(h.repositories.messages.persistIOMessages).toHaveBeenCalledWith([]);
            expect(h.getRepository).toHaveBeenCalledTimes(1);
            expect(h.operations[0]?.run).not.toHaveBeenCalled();
            expect(h.runInTransaction).not.toHaveBeenCalled();
            expect(h.send).not.toHaveBeenCalled();
            expect(h.logger.getEntries()).toEqual([
                ...messages
                    .filter((message) => message.isHandled)
                    .map((message) => ({
                        level: 'warn',
                        message: 'Message was already handled',
                        context: expect.objectContaining({ message }),
                    })),
                ...messages
                    .filter((message) => message.type !== 'inbound')
                    .map((message) => ({
                        level: 'warn',
                        message: 'Message is not inbound',
                        context: expect.objectContaining({ message }),
                    })),
                {
                    level: 'warn',
                    message: 'No messages found to process',
                    context: expect.objectContaining({ message: [] }),
                },
            ]);
        });

        test('passes only unhandled inbound messages to operations and marks only those handled', async () => {
            const h = createHarness();
            const handled = createLoggedMessage({ id: 2, isHandled: true });
            const outbound = createLoggedMessage({ id: 3, type: 'outbound' });
            const other = createLoggedMessage({ id: 4 });
            h.repositories.messages.persistIOMessages.mockResolvedValue([
                handled,
                ...h.incoming,
                outbound,
                other,
            ]);

            await h.engine.handle(h.input);

            const expected = [...h.incoming, other];
            expect(h.operations[0]?.run).toHaveBeenCalledWith({
                story: h.story,
                messages: expected,
                logger: h.logger,
            });
            expect(h.transactionRepositories.messages.markAllHandled).toHaveBeenCalledTimes(1);
            expect(h.transactionRepositories.messages.markAllHandled).toHaveBeenCalledWith(
                expected,
                h.story,
            );
            expect(h.logger.getEntries().filter((entry) => entry.level === 'warn')).toEqual([
                {
                    level: 'warn',
                    message: 'Message was already handled',
                    context: expect.objectContaining({ message: handled }),
                },
                {
                    level: 'warn',
                    message: 'Message is not inbound',
                    context: expect.objectContaining({ message: outbound }),
                },
            ]);
        });

        test.each([undefined, null, ''])(
            'stops if the first persisted message has externalId %p',
            async (externalId) => {
                const h = createHarness();
                h.repositories.messages.persistIOMessages.mockResolvedValue([
                    { ...createLoggedMessage(), externalId } as unknown as LoggedIOMessage,
                    createLoggedMessage({ id: 2 }),
                ]);

                await h.engine.handle(h.input);

                expect(h.getRepository).toHaveBeenCalledTimes(1);
                expect(h.operations[0]?.run).not.toHaveBeenCalled();
                expect(h.runInTransaction).not.toHaveBeenCalled();
                expect(h.send).not.toHaveBeenCalled();
                expect(h.logger.getEntries()).toEqual([
                    {
                        level: 'warn',
                        message: 'No external ID found in messages',
                        context: expect.objectContaining({ message: h.input }),
                    },
                ]);
            },
        );

        test('uses the first eligible persisted message to look up the story', async () => {
            const h = createHarness();
            const externalId = createId('persisted-external');
            h.repositories.messages.persistIOMessages.mockResolvedValue([
                createLoggedMessage({ isHandled: true }),
                createLoggedMessage({ id: 2, externalId }),
                createLoggedMessage({ id: 3 }),
            ]);

            await h.engine.handle(h.input);

            expect(
                h.repositories.stories.findOrCreateActiveStoryForExternalId,
            ).toHaveBeenCalledTimes(1);
            expect(
                h.repositories.stories.findOrCreateActiveStoryForExternalId,
            ).toHaveBeenCalledWith(externalId);
        });

        test('awaits operations sequentially and passes each the accumulated story changes', async () => {
            const pending = Promise.withResolvers<PipelineOperationResult>();
            const started = Promise.withResolvers<undefined>();
            const first = createOperation();
            first.run.mockImplementation(() => {
                started.resolve(undefined);
                return pending.promise;
            });
            const second = createOperation({
                stopProcessing: false,
                storyChanges: { status: 'closed' },
            });
            const third = createOperation();
            const h = createHarness([first, second, third]);
            const handling = h.engine.handle(h.input);
            await started.promise;

            expect(second.run).not.toHaveBeenCalled();
            expect(h.runInTransaction).not.toHaveBeenCalled();
            pending.resolve({
                stopProcessing: false,
                storyChanges: { status: 'in-progress', externalId: createId('updated-external') },
            });
            await handling;

            expect(second.run).toHaveBeenCalledTimes(1);
            expect(second.run).toHaveBeenCalledWith({
                story: {
                    ...h.story,
                    status: 'in-progress',
                    externalId: createId('updated-external'),
                },
                messages: h.incoming,
                logger: h.logger,
            });
            const updatedStory: Story = {
                ...h.story,
                status: 'closed',
                externalId: createId('updated-external'),
            };
            expect(third.run).toHaveBeenCalledTimes(1);
            expect(third.run).toHaveBeenCalledWith({
                story: updatedStory,
                messages: h.incoming,
                logger: h.logger,
            });
            expect(h.transactionRepositories.stories.save).toHaveBeenCalledTimes(1);
            expect(h.transactionRepositories.stories.save).toHaveBeenCalledWith(updatedStory);
            expect(h.story.status).toBe('new');
            expect(h.story.externalId).toBe(h.input.externalId);
        });

        test.each([false, true])(
            'collects outbound messages in operation order (stop early: %p)',
            async (stopProcessing) => {
                const firstReply: IOMessageOutbound = {
                    ...createMessage('reply-one'),
                    type: 'outbound',
                };
                const secondReply: IOMessageOutbound = {
                    ...createMessage('reply-two'),
                    type: 'outbound',
                };
                const first = createOperation({ stopProcessing: false, newMessages: [firstReply] });
                const second = createOperation({
                    stopProcessing,
                    newMessages: [secondReply],
                    storyChanges: { status: 'closed' },
                });
                const third = createOperation();
                const h = createHarness([first, second, third]);
                const loggedReplies = [
                    createLoggedMessage({ id: 10, type: 'outbound' }),
                    createLoggedMessage({ id: 11, type: 'outbound' }),
                ];
                h.transactionRepositories.messages.persistIOMessages.mockResolvedValue(
                    loggedReplies,
                );

                await h.engine.handle(h.input);

                const updatedStory: Story = { ...h.story, status: 'closed' };
                expect(first.run).toHaveBeenCalledTimes(1);
                expect(second.run).toHaveBeenCalledTimes(1);
                expect(third.run).toHaveBeenCalledTimes(stopProcessing ? 0 : 1);
                expect(h.transactionRepositories.stories.save).toHaveBeenCalledTimes(1);
                expect(h.transactionRepositories.stories.save).toHaveBeenCalledWith(updatedStory);
                expect(h.transactionRepositories.messages.markAllHandled).toHaveBeenCalledTimes(1);
                expect(h.transactionRepositories.messages.markAllHandled).toHaveBeenCalledWith(
                    h.incoming,
                    updatedStory,
                );
                expect(h.transactionRepositories.messages.persistIOMessages).toHaveBeenCalledTimes(
                    1,
                );
                expect(h.transactionRepositories.messages.persistIOMessages).toHaveBeenCalledWith(
                    [firstReply, secondReply],
                    updatedStory,
                );
                expect(h.send).toHaveBeenCalledTimes(1);
                expect(h.send).toHaveBeenCalledWith([firstReply, secondReply]);
                expect(h.repositories.messages.markAllHandled).toHaveBeenCalledTimes(1);
                expect(h.repositories.messages.markAllHandled).toHaveBeenCalledWith(
                    loggedReplies,
                    updatedStory,
                );
                expect(
                    h.logger.getEntries().filter((entry) => entry.message === 'Pipeline stopped'),
                ).toHaveLength(stopProcessing ? 1 : 0);
            },
        );

        test('saves the unchanged story and completes all persistence steps when operations produce no output', async () => {
            const h = createHarness();

            await h.engine.handle(h.input);

            expect(h.runInTransaction).toHaveBeenCalledTimes(1);
            expect(h.transactionGetRepository.mock.calls).toEqual([
                [StoryRepository],
                [LoggedIOMessageRepository],
            ]);
            expect(h.transactionRepositories.stories.save).toHaveBeenCalledTimes(1);
            expect(h.transactionRepositories.stories.save).toHaveBeenCalledWith(h.story);
            expect(h.transactionRepositories.messages.markAllHandled).toHaveBeenCalledTimes(1);
            expect(h.transactionRepositories.messages.markAllHandled).toHaveBeenCalledWith(
                h.incoming,
                h.story,
            );
            expect(h.transactionRepositories.messages.persistIOMessages).toHaveBeenCalledTimes(1);
            expect(h.transactionRepositories.messages.persistIOMessages).toHaveBeenCalledWith(
                [],
                h.story,
            );
            expect(h.send).toHaveBeenCalledTimes(1);
            expect(h.send).toHaveBeenCalledWith([]);
            expect(h.repositories.messages.markAllHandled).toHaveBeenCalledTimes(1);
            expect(h.repositories.messages.markAllHandled).toHaveBeenCalledWith([], h.story);
            expect(h.repositories.stories.save).not.toHaveBeenCalled();
            expect(h.getRepository.mock.calls).toEqual([
                [LoggedIOMessageRepository],
                [StoryRepository],
                [LoggedIOMessageRepository],
            ]);
        });

        test('waits for transaction commit, sending and final acknowledgement before completing', async () => {
            const h = createHarness();
            const transactionCompleted = Promise.withResolvers<undefined>();
            const commit = Promise.withResolvers<undefined>();
            const sendStarted = Promise.withResolvers<undefined>();
            const sent = Promise.withResolvers<undefined>();
            const acknowledgementStarted = Promise.withResolvers<undefined>();
            const acknowledged = Promise.withResolvers<undefined>();
            const completed = jest.fn();
            h.runInTransaction.mockImplementationOnce(async (action) => {
                const result = await action(h.transactionManager);
                transactionCompleted.resolve(undefined);
                await commit.promise;
                return result;
            });
            h.send.mockImplementationOnce(() => {
                sendStarted.resolve(undefined);
                return sent.promise;
            });
            h.repositories.messages.markAllHandled.mockImplementationOnce(() => {
                acknowledgementStarted.resolve(undefined);
                return acknowledged.promise;
            });

            const handling = h.engine.handle(h.input).then(completed);
            await transactionCompleted.promise;
            expect(h.send).not.toHaveBeenCalled();
            expect(h.repositories.messages.markAllHandled).not.toHaveBeenCalled();
            commit.resolve(undefined);
            await sendStarted.promise;
            expect(h.repositories.messages.markAllHandled).not.toHaveBeenCalled();
            sent.resolve(undefined);
            await acknowledgementStarted.promise;
            expect(completed).not.toHaveBeenCalled();
            acknowledged.resolve(undefined);
            await handling;
            expect(completed).toHaveBeenCalledTimes(1);

            const calls = [
                h.transactionRepositories.stories.save,
                h.transactionRepositories.messages.markAllHandled,
                h.transactionRepositories.messages.persistIOMessages,
            ];
            const order = calls.map((mock) => mock.mock.invocationCallOrder[0] ?? 0);
            expect(order.every((call) => call > 0)).toBe(true);
            expect(order).toEqual([...order].sort((a, b) => a - b));
        });

        describe('failures', () => {
            test('propagates sanitizer failures before accessing repositories', async () => {
                const h = createHarness();
                const error = new Error('Sanitization failed');
                sanitizeMessageArray.mockImplementationOnce(() => {
                    throw error;
                });

                await expect(h.engine.handle(h.input)).rejects.toBe(error);

                expect(h.getRepository).not.toHaveBeenCalled();
                expect(h.operations[0]?.run).not.toHaveBeenCalled();
                expect(h.send).not.toHaveBeenCalled();
            });

            test.each(['lookup', 'persist'] as const)(
                'logs and propagates inbound persistence failures: %s',
                async (stage) => {
                    const h = createHarness();
                    const error = new Error('Persistence failed');
                    if (stage === 'lookup') {
                        h.getRepository.mockRejectedValueOnce(error);
                    } else {
                        h.repositories.messages.persistIOMessages.mockRejectedValueOnce(error);
                    }

                    await expect(h.engine.handle(h.input)).rejects.toBe(error);

                    expect(h.logger.getEntries()).toEqual([
                        {
                            level: 'error',
                            message: 'Failed to persist messages',
                            error,
                            context: expect.objectContaining({
                                source: 'PipelineEngine',
                                message: h.input,
                            }),
                        },
                    ]);
                    expect(
                        h.repositories.stories.findOrCreateActiveStoryForExternalId,
                    ).not.toHaveBeenCalled();
                    expect(h.operations[0]?.run).not.toHaveBeenCalled();
                    expect(h.runInTransaction).not.toHaveBeenCalled();
                    expect(h.send).not.toHaveBeenCalled();
                },
            );

            test('logs and propagates story loading failures without executing operations', async () => {
                const h = createHarness();
                const error = new Error('Story failed');
                h.repositories.stories.findOrCreateActiveStoryForExternalId.mockRejectedValueOnce(
                    error,
                );

                await expect(h.engine.handle(h.input)).rejects.toBe(error);

                expect(h.logger.getEntries()).toEqual([
                    {
                        level: 'error',
                        message: 'Failed to load or create story',
                        error,
                        context: expect.objectContaining({ externalId: h.input.externalId }),
                    },
                ]);
                expect(h.operations[0]?.run).not.toHaveBeenCalled();
                expect(h.runInTransaction).not.toHaveBeenCalled();
                expect(h.send).not.toHaveBeenCalled();
            });

            test.each([false, true])(
                'logs operation failures and stops later operations (synchronous: %p)',
                async (synchronous) => {
                    const error = new Error('Operation failed');
                    const first = createOperation();
                    const second = createOperation();
                    const h = createHarness([first, second]);
                    if (synchronous) {
                        first.run.mockImplementationOnce(() => {
                            throw error;
                        });
                    } else {
                        first.run.mockRejectedValueOnce(error);
                    }

                    await expect(h.engine.handle(h.input)).rejects.toBe(error);

                    expect(
                        h.logger.getEntries().filter((entry) => entry.level === 'error'),
                    ).toEqual([
                        {
                            level: 'error',
                            message: 'Operation failed',
                            error,
                            context: expect.objectContaining({
                                operation: 'Object',
                                context: { story: h.story, messages: h.incoming, logger: h.logger },
                            }),
                        },
                    ]);
                    expect(h.logger.getEntries().map((entry) => entry.message)).toEqual([
                        'Start message processing',
                        'Operation started',
                        'Operation failed',
                    ]);
                    expect(second.run).not.toHaveBeenCalled();
                    expect(h.runInTransaction).not.toHaveBeenCalled();
                    expect(h.send).not.toHaveBeenCalled();
                },
            );

            test.each([
                'transaction',
                'story lookup',
                'save',
                'message lookup',
                'mark incoming',
                'persist outgoing',
            ] as const)('logs storage failures and does not send messages: %s', async (stage) => {
                const h = createHarness();
                const error = new Error(`Failed: ${stage}`);
                switch (stage) {
                    case 'transaction':
                        h.runInTransaction.mockRejectedValueOnce(error);
                        break;
                    case 'story lookup':
                        h.transactionGetRepository.mockRejectedValueOnce(error);
                        break;
                    case 'save':
                        h.transactionRepositories.stories.save.mockRejectedValueOnce(error);
                        break;
                    case 'message lookup':
                        h.transactionGetRepository
                            .mockResolvedValueOnce(h.transactionRepositories.stories)
                            .mockRejectedValueOnce(error);
                        break;
                    case 'mark incoming':
                        h.transactionRepositories.messages.markAllHandled.mockRejectedValueOnce(
                            error,
                        );
                        break;
                    case 'persist outgoing':
                        h.transactionRepositories.messages.persistIOMessages.mockRejectedValueOnce(
                            error,
                        );
                        break;
                }

                await expect(h.engine.handle(h.input)).rejects.toBe(error);

                expect(h.logger.getEntries().filter((entry) => entry.level === 'error')).toEqual([
                    {
                        level: 'error',
                        message: 'Pipeline updates failed',
                        error,
                        context: expect.objectContaining({
                            pipelineResult: { newMessages: [], updatedStory: h.story },
                        }),
                    },
                ]);
                expect(h.send).not.toHaveBeenCalled();
                expect(h.repositories.messages.markAllHandled).not.toHaveBeenCalled();
            });

            test.each(['send', 'repository lookup', 'mark outgoing'] as const)(
                'logs delivery failures and propagates the original error: %s',
                async (stage) => {
                    const h = createHarness();
                    const error = new Error(`Failed: ${stage}`);
                    if (stage === 'send') {
                        h.send.mockRejectedValueOnce(error);
                    } else if (stage === 'repository lookup') {
                        h.getRepository
                            .mockResolvedValueOnce(h.repositories.messages)
                            .mockResolvedValueOnce(h.repositories.stories)
                            .mockRejectedValueOnce(error);
                    } else {
                        h.repositories.messages.markAllHandled.mockRejectedValueOnce(error);
                    }

                    await expect(h.engine.handle(h.input)).rejects.toBe(error);

                    expect(
                        h.transactionRepositories.messages.persistIOMessages,
                    ).toHaveBeenCalledTimes(1);
                    expect(h.send).toHaveBeenCalledTimes(1);
                    if (stage !== 'mark outgoing') {
                        expect(h.repositories.messages.markAllHandled).not.toHaveBeenCalled();
                    }
                    expect(
                        h.logger.getEntries().filter((entry) => entry.level === 'error'),
                    ).toEqual([
                        {
                            level: 'error',
                            message: 'Pipeline message sending failed',
                            error,
                            context: expect.objectContaining({
                                pipelineResult: { newMessages: [], updatedStory: h.story },
                            }),
                        },
                    ]);
                },
            );
        });
    });
});
