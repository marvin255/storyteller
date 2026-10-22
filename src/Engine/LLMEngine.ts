import type { Engine } from '../Contracts/Engine/Engine.js';
import type { IOChannelSender } from '../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../Contracts/IOChannel/IOMessageOutbound.js';
import { createRandomId } from '../Contracts/Shared/Id.js';

export class LLMEngine implements Engine {
    constructor(private readonly sender: IOChannelSender) {}

    async handle(message: IOMessageInbound | IOMessageInbound[]): Promise<void> {
        const messages = Array.isArray(message) ? message : [message];
        for (const inboundMessage of messages) {
            await this.sender.send(this.createOutboundMessage(inboundMessage));
        }
    }

    private createOutboundMessage(message: IOMessageInbound): IOMessageOutbound {
        return {
            type: 'outbound',
            messageId: createRandomId(),
            externalId: message.externalId,
            userId: message.userId,
            content: `LLM response placeholder: ${message.content}`,
            createdAt: new Date(),
        };
    }
}
