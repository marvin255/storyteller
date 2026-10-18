import type { LoggedIOMessage } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import { LoggedIOMessageRepository } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageRepository.js';
import type { Story } from '../../Contracts/Domain/Story/Story.js';
import { StoryRepository } from '../../Contracts/Domain/Story/StoryRepository.js';
import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOMessageInbound } from '../../Contracts/IOChannel/IOMessageInbound.js';
import type { Logger } from '../../Contracts/Logger/Logger.js';
import type { EntityManager } from '../../Contracts/Persistence/EntityManager.js';
import { createId, createRandomId, type Id } from '../../Contracts/Shared/Id.js';
import { sanitizeMessageArray } from '../sanitizeMessageArray.js';
import type { PipelineOperation } from './PipelineOperation.js';
import type { PipelineOperationResult } from './PipelineOperationResult.js';

type IncomingMessage = IOMessageInbound | IOMessageInbound[];

/**
 * Narrative engine that processes messages through a pipeline of operations.
 */
export class PipelineEngine implements Engine {
    private pipelineRunLogger: Logger | undefined;

    constructor(
        private readonly operations: readonly Readonly<PipelineOperation>[],
        private readonly entityManager: EntityManager,
        private readonly logger: Logger,
    ) {
        if (this.operations.length === 0) {
            throw new Error('PipelineEngine requires at least one operation to function.');
        }
    }

    /**
     * Handles incoming messages by processing them through the pipeline.
     */
    async handle(message: IncomingMessage): Promise<void> {
        const messages = await this.sanitizeAndLogIOMessages(message);
        if (messages.length === 0) {
            this.getLogger().warn('No messages found to process', { message });
            return Promise.resolve();
        }

        const externalId = this.getExternalIdFromMessages(messages);
        if (!externalId) {
            this.getLogger().warn('No external ID found in messages', { message });
            return Promise.resolve();
        }
        this.extendLoggerWithContext({ externalId });

        const story = await this.loadOrCreateStory(externalId);
        this.extendLoggerWithContext({ storyId: story.id });

        this.getLogger().info('Start message processing', { messages });
        await this.runAllOperations(story, messages);
        this.getLogger().info('Message processing completed');

        this.resetLogger();
    }

    /**
     * Sanitizes incoming messages, then persists them to the database.
     */
    private async sanitizeAndLogIOMessages(message: IncomingMessage): Promise<LoggedIOMessage[]> {
        const sanitizedMessages = sanitizeMessageArray(message, this.getLogger());
        let messages: LoggedIOMessage[];
        try {
            messages = await this.persistMessages(sanitizedMessages);
        } catch (error) {
            this.getLogger().error('Failed to persist messages', error, { message });
            throw error;
        }
        return Promise.resolve(messages);
    }

    /**
     * Persists the incoming messages and filters out those that are already handled or not inbound.
     */
    private async persistMessages(messages: IOMessageInbound[]): Promise<LoggedIOMessage[]> {
        const repo = await this.entityManager.getRepository(LoggedIOMessageRepository);
        const persistedMessages = await repo.persistIOMessages(messages);
        const unhandledInboundMessages = persistedMessages.filter((message) => {
            if (message.isHandled) {
                this.getLogger().warn('Message was already handled', { message });
            }
            if (message.type !== 'inbound') {
                this.getLogger().warn('Message is not inbound', { message });
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
            this.getLogger().error('Failed to load or create story', error);
            throw error;
        }

        return story;
    }

    /**
     * Runs all operations in the pipeline sequentially, passing the context to each operation.
     */
    private async runAllOperations(story: Story, messages: LoggedIOMessage[]): Promise<void> {
        for (const operation of this.operations) {
            const result = await this.runOneOperation(operation, story, messages);
            if (result.stopProcessing) {
                this.getLogger().info('Pipeline stopped');
                break;
            }
        }
    }

    /**
     * Runs a single operation in the pipeline and returns the result.
     */
    private async runOneOperation(
        operation: PipelineOperation,
        story: Story,
        messages: LoggedIOMessage[],
    ): Promise<PipelineOperationResult> {
        const operationLogger = this.getLogger().child({ operation: operation.constructor.name });
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
     * Retrieves the logger for the current pipeline run, creating it if it doesn't exist.
     */
    private getLogger(): Logger {
        this.pipelineRunLogger ??= this.logger.child({
            source: 'PipelineEngine',
            runId: createRandomId(),
        });
        return this.pipelineRunLogger;
    }

    /**
     * Extends the current logger with additional context for the pipeline run.
     */
    private extendLoggerWithContext(context: Record<string, unknown>): void {
        this.pipelineRunLogger = this.getLogger().child(context);
    }

    /** Resets the logger for the current pipeline run, clearing any context that was added. */
    private resetLogger(): void {
        this.pipelineRunLogger = undefined;
    }
}
