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
import type { PipelineOperationContext } from './PipelineOperationContext.js';

/**
 * Narrative engine that processes messages through a pipeline of operations.
 */
export class PipelineEngine implements Engine {
    constructor(
        private readonly operations: Readonly<PipelineOperation>[],
        private readonly entityManager: EntityManager,
        private logger: Logger,
    ) {
        this.logger = this.logger.child({ source: 'PipelineEngine' });
    }

    /**
     * Handles incoming messages by processing them through the pipeline.
     */
    async handle(message: IOMessageInbound | IOMessageInbound[]): Promise<void> {
        if (this.operations.length === 0) {
            this.logger.warn('No operations found to process', { message });
            return Promise.resolve();
        }

        const messages = await this.persistMessages(sanitizeMessageArray(message, this.logger));
        if (messages.length === 0) {
            this.logger.warn('No messages found to process', { message });
            return Promise.resolve();
        }

        const externalId = this.getExternalId(messages);
        if (!externalId) {
            this.logger.warn('No external ID found in messages', { message });
            return Promise.resolve();
        }

        this.logger = this.logger.child({ externalId });
        this.logger.info('Start message processing', { messages });

        let story: Story;
        try {
            story = await this.loadOrCreateStory(externalId);
        } catch (error) {
            this.logger.error('Failed to load or create story', error);
            throw error;
        }

        for (const operation of this.operations) {
            const logger = this.logger.child({ operation: operation.constructor.name });
            const context = this.createOperationContext(story, messages, logger);
            try {
                this.logger.info('Operation started', { context });
                const result = await operation.run(context);
                this.logger.info('Operation completed', { result, context });
                if (result.stopProcessing) {
                    this.logger.info('Pipeline stopped');
                    break;
                }
            } catch (error) {
                this.logger.error('Operation failed', error, { context });
                throw error;
            }
        }

        this.logger.info('Message processing completed');
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
    private getExternalId(messages: LoggedIOMessage[]): Id | undefined {
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

        const story = await storyRepository.findActiveStoryByExternalId(externalId);
        if (story) {
            this.logger = this.logger.child({ storyId: story.id });
            this.logger.info('Found existing story');
            return Promise.resolve(story);
        }

        const newStory = await storyRepository.createNewStoryForExternalId(externalId);

        this.logger = this.logger.child({ storyId: newStory.id });
        this.logger.info('New story created');

        return Promise.resolve(newStory);
    }

    /**
     * Creates a context object for the pipeline operation.
     */
    private createOperationContext(
        story: Story,
        messages: LoggedIOMessage[],
        logger: Logger,
    ): PipelineOperationContext {
        return {
            story,
            messages,
            logger: logger,
        };
    }
}
