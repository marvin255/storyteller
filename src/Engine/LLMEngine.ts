import { createRandomId } from '../Contracts/Data/Id.js';
import type { Engine } from '../Contracts/Engine/Engine.js';
import type { IOChannelSender } from '../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../Contracts/IOChannel/IOMessageOutbound.js';

export class LLMEngine implements Engine {
    constructor(private readonly sender: IOChannelSender) {}

    handle(message: IOMessageInbound | IOMessageInbound[]): undefined {
        const messages = Array.isArray(message) ? message : [message];
        messages
            .map((inboundMessage) => this.createOutboundMessage(inboundMessage))
            .forEach((outboundMessage) => {
                this.sender.send(outboundMessage);
            });

        return undefined;
    }

    private createOutboundMessage(message: IOMessageInbound): IOMessageOutbound {
        return {
            id: createRandomId(),
            sessionId: message.sessionId,
            userId: message.userId,
            content: `LLM response placeholder: ${message.content}`,
        };
    }
}
