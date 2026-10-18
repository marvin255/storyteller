import type { LoggedIOMessage } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import { LoggedIOMessageRepository } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageRepository.js';
import type { Story } from '../../Contracts/Domain/Story/Story.js';
import { StoryRepository } from '../../Contracts/Domain/Story/StoryRepository.js';
import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOMessageInbound } from '../../Contracts/IOChannel/IOMessageInbound.js';
import type { Logger } from '../../Contracts/Logger/Logger.js';
import type { EntityManager } from '../../Contracts/Persistence/EntityManager.js';
import { createId, type Id } from '../../Contracts/Shared/Id.js';
import { sanitizeMessageArray } from '../sanitizeMessageArray.js';
import type { PipelineOperation } from './PipelineOperation.js';
import type { PipelineOperationResult } from './PipelineOperationResult.js';

type IncomingMessage = IOMessageInbound | IOMessageInbound[];

/**
 * Narrative engine that processes messages through a pipeline of operations.
 */
export class PipelineEngine implements Engine {
    constructor(
        private readonly operations: Readonly<PipelineOperation>[],
        private readonly entityManager: EntityManager,
        private logger: Logger,
    ) {
        if (this.operations.length === 0) {
            throw new Error('PipelineEngine requires at least one operation to function.');
        }
        this.logger = this.logger.child({ source: 'PipelineEngine' });
    }

    /**
     * Handles incoming messages by processing them through the pipeline.
     */
    async handle(message: IncomingMessage): Promise<void> {
        const messages = await this.sanitizeAndLogIOMessages(message);
        if (messages.length === 0) {
            this.logger.warn('No messages found to process', { message });
            return Promise.resolve();
        }

        const externalId = this.getExternalIdFromMessages(messages);
        if (!externalId) {
            this.logger.warn('No external ID found in messages', { message });
            return Promise.resolve();
        }

        const story = await this.loadOrCreateStory(externalId);

        this.logger = this.logger.child({ externalId });
        this.logger.info('Start message processing', { messages });

        await this.runAllOperations(story, messages);

        this.logger.info('Message processing completed');
    }

    /**
     * Sanitizes incoming messages, then persists them to the database.
     */
    private async sanitizeAndLogIOMessages(message: IncomingMessage): Promise<LoggedIOMessage[]> {
        const sanitizedMessages = sanitizeMessageArray(message, this.logger);
        let messages: LoggedIOMessage[];
        try {
            messages = await this.persistMessages(sanitizedMessages);
        } catch (error) {
            this.logger.error('Failed to persist messages', error, { message });
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

        let story: Story | null;
        try {
            story = await storyRepository.findActiveStoryByExternalId(externalId);
        } catch (error) {
            this.logger.error('Failed to load story', error);
            throw error;
        }
        if (story) {
            this.logger = this.logger.child({ storyId: story.id });
            this.logger.info('Found existing story');
            return Promise.resolve(story);
        }

        let newStory: Story;
        try {
            newStory = await storyRepository.createNewStoryForExternalId(externalId);
        } catch (error) {
            this.logger.error('Failed to create story', error);
            throw error;
        }

        this.logger = this.logger.child({ storyId: newStory.id });
        this.logger.info('New story created');

        return Promise.resolve(newStory);
    }

    /**
     * Runs all operations in the pipeline sequentially, passing the context to each operation.
     */
    private async runAllOperations(story: Story, messages: LoggedIOMessage[]): Promise<void> {
        for (const operation of this.operations) {
            const result = await this.runOneOperation(operation, story, messages);
            if (result.stopProcessing) {
                this.logger.info('Pipeline stopped');
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
        const logger = this.logger.child({ operation: operation.constructor.name });
        const context = {
            story,
            messages,
            logger: logger,
        };

        logger.info('Operation started', { context });

        let result: PipelineOperationResult;
        try {
            result = await operation.run(context);
        } catch (error) {
            logger.error('Operation failed', error, { context });
            throw error;
        }

        logger.info('Operation completed', { result, context });

        return result;
    }
}
