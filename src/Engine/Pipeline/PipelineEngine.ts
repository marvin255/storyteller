import type { LoggedIOMessage } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import { LoggedIOMessageRepository } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageRepository.js';
import type { Story } from '../../Contracts/Domain/Story/Story.js';
import { StoryRepository } from '../../Contracts/Domain/Story/StoryRepository.js';
import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOChannelSender } from '../../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../Contracts/IOChannel/IOMessageOutbound.js';
import type { Logger } from '../../Contracts/Logger/Logger.js';
import type { EntityManager } from '../../Contracts/Persistence/EntityManager.js';
import { createId, type Id } from '../../Contracts/Shared/Id.js';
import { sanitizeMessageArray } from '../sanitizeMessageArray.js';
import { PipelineLoggerWrapper } from './PipelineLoggerWrapper.js';
import type { PipelineOperation } from './PipelineOperation.js';
import type { PipelineOperationResult } from './PipelineOperationResult.js';

type IncomingMessage = IOMessageInbound | IOMessageInbound[];

interface PipelineResult {
    readonly newMessages: IOMessageOutbound[];
    readonly updatedStory: Story;
}

/**
 * Narrative engine that processes messages through a pipeline of operations.
 */
export class PipelineEngine implements Engine {
    private readonly logger: PipelineLoggerWrapper;

    constructor(
        private readonly operations: readonly Readonly<PipelineOperation>[],
        private readonly entityManager: EntityManager,
        private readonly messageSender: IOChannelSender,
        logger: Logger,
    ) {
        if (this.operations.length === 0) {
            throw new Error('PipelineEngine requires at least one operation to function.');
        }
        this.logger = new PipelineLoggerWrapper(logger);
    }

    /**
     * Handles incoming messages by processing them through the pipeline.
     */
    async handle(message: IncomingMessage): Promise<void> {
        this.logger.resetLogger();

        const messages = await this.sanitizeAndLogIncomingMessages(message);
        if (messages.length === 0) {
            this.logger.warn('No messages found to process', { message });
            return Promise.resolve();
        }

        const externalId = this.getExternalIdFromMessages(messages);
        if (!externalId) {
            this.logger.warn('No external ID found in messages', { message });
            return Promise.resolve();
        }
        this.logger.extendLoggerWithContext({ externalId });

        const story = await this.loadOrCreateStory(externalId);
        this.logger.extendLoggerWithContext({ storyId: story.id });

        this.logger.info('Start message processing', { messages });
        const pipelineResult = await this.runPipeline(story, messages);
        this.logger.info('Message processing completed', { pipelineResult });

        await this.storePipelineResults(messages, pipelineResult);

        this.logger.resetLogger();
    }

    /**
     * Sanitizes incoming messages, then persists them to the database.
     */
    private async sanitizeAndLogIncomingMessages(
        message: IncomingMessage,
    ): Promise<LoggedIOMessage[]> {
        const sanitizedMessages = sanitizeMessageArray(message, this.logger);
        let messages: LoggedIOMessage[];
        try {
            messages = await this.persistIncomingMessages(sanitizedMessages);
        } catch (error) {
            this.logger.error('Failed to persist messages', error, { message });
            throw error;
        }
        return Promise.resolve(messages);
    }

    /**
     * Persists the incoming messages and filters out those that are already handled or not inbound.
     */
    private async persistIncomingMessages(
        messages: IOMessageInbound[],
    ): Promise<LoggedIOMessage[]> {
        const repo = await this.entityManager.getRepository(LoggedIOMessageRepository);
        const persistedMessages = await repo.persistIOMessages(messages);
        const unhandledInboundMessages = persistedMessages.filter((message) => {
            if (message.isHandled) {
                this.logger.warn('Message was already handled', { message });
            }
            if (message.type !== 'inbound') {
                this.logger.warn('Message is not inbound', { message });
            }
            return !message.isHandled && message.type === 'inbound';
        });
        return Promise.resolve(unhandledInboundMessages);
    }

    /**
     * Extracts the external ID from the first message in the array.
     */
    private getExternalIdFromMessages(messages: LoggedIOMessage[]): Id | undefined {
        if (messages.length === 0 || !messages[0]?.externalId) {
            return undefined;
        }
        return createId(messages[0].externalId);
    }

    /**
     * Loads an existing story by external ID or creates a new one if none exists.
     */
    private async loadOrCreateStory(externalId: Id): Promise<Story> {
        const storyRepository = await this.entityManager.getRepository(StoryRepository);
        let story: Story;
        try {
            story = await storyRepository.findOrCreateActiveStoryForExternalId(externalId);
        } catch (error) {
            this.logger.error('Failed to load or create story', error);
            throw error;
        }
        return story;
    }

    /**
     * Runs all operations in the pipeline sequentially, passing the context to each operation.
     */
    private async runPipeline(story: Story, messages: LoggedIOMessage[]): Promise<PipelineResult> {
        const newMessages: IOMessageOutbound[] = [];
        let updatedStory = story;
        for (const operation of this.operations) {
            const result = await this.runPipelineOperation(operation, updatedStory, messages);
            if (result.newMessages) {
                newMessages.push(...result.newMessages);
            }
            if (result.storyChanges) {
                updatedStory = { ...updatedStory, ...result.storyChanges };
            }
            if (result.stopProcessing) {
                this.logger.info('Pipeline stopped');
                break;
            }
        }
        return { newMessages, updatedStory: updatedStory };
    }

    /**
     * Runs a single operation in the pipeline and returns the result.
     */
    private async runPipelineOperation(
        operation: PipelineOperation,
        story: Story,
        messages: LoggedIOMessage[],
    ): Promise<PipelineOperationResult> {
        const operationLogger = this.logger.child({
            operation: operation.constructor.name,
        });

        const context = {
            story,
            messages,
            logger: operationLogger,
        };

        operationLogger.info('Operation started', { context });

        let result: PipelineOperationResult;
        try {
            result = await operation.run(context);
        } catch (error) {
            operationLogger.error('Operation failed', error, { context });
            throw error;
        }

        operationLogger.info('Operation completed', { result, context });

        return result;
    }

    /**
     * Stores all changes made by pipeline.
     */
    private async storePipelineResults(
        incomingMessages: LoggedIOMessage[],
        pipelineResult: PipelineResult,
    ): Promise<void> {
        let outboundLoggedMessages: LoggedIOMessage[];
        try {
            outboundLoggedMessages = await this.entityManager.runInTransaction(async (em) => {
                const storyRepository = await em.getRepository(StoryRepository);
                await storyRepository.save(pipelineResult.updatedStory);
                const messageRepository = await em.getRepository(LoggedIOMessageRepository);
                await messageRepository.markAllHandled(
                    incomingMessages,
                    pipelineResult.updatedStory,
                );
                return messageRepository.persistIOMessages(
                    pipelineResult.newMessages,
                    pipelineResult.updatedStory,
                );
            });
        } catch (error) {
            this.logger.error('Pipeline updates failed', error, { pipelineResult });
            throw error;
        }

        try {
            await this.messageSender.send(pipelineResult.newMessages);
        } catch (error) {
            this.logger.error('Pipeline message sending failed', error, { pipelineResult });
            throw error;
        }

        try {
            const messageRepository =
                await this.entityManager.getRepository(LoggedIOMessageRepository);
            await messageRepository.markAllHandled(
                outboundLoggedMessages,
                pipelineResult.updatedStory,
            );
        } catch (error) {
            this.logger.error('Pipeline message sending failed', error, { pipelineResult });
            throw error;
        }
    }
}
