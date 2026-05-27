import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import { createId, type Id } from '../../Contracts/Data/Id.js';
import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOChannelListener } from '../../Contracts/IOChannel/IOChannelListener.js';
import type { IOChannelSender } from '../../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageOutbound } from '../../Contracts/IOChannel/IOMessageOutbound.js';

export class IOChannelConsole implements IOChannelListener, IOChannelSender {
    constructor(
        private readonly input: Readable = process.stdin,
        private readonly output: Writable = process.stdout,
        private readonly sessionId: Id = createId('user'),
        private readonly applicationId: Id = createId('storyteller'),
    ) {}

    attachEngine(_engine: Engine): void {
        const readlineInstance = this.createReadlineInstance();
        this.write(this.formatOutboundMessage(''));
        readlineInstance.on('line', (line) => {
            if (line === '/exit') {
                readlineInstance.close();
            } else {
                this.write(this.formatInboundMessage(line));
                this.write(this.formatOutboundMessage(''));
            }
        });
    }

    send(message: IOMessageOutbound | IOMessageOutbound[]): void {
        const messages = Array.isArray(message) ? message : [message];
        messages
            .map((outboundMessage) => this.formatOutboundMessage(outboundMessage))
            .forEach((formattedMessage) => {
                this.write(formattedMessage);
            });
    }

    private formatInboundMessage(message: string): string {
        return this.formatMessage(this.sessionId, message);
    }

    private formatOutboundMessage(message: IOMessageOutbound | string): string {
        const content = typeof message === 'string' ? message : message.content;
        return this.formatMessage(this.applicationId, content);
    }

    private formatMessage(sender: string, message: string): string {
        return `${sender} > ${message}\n`;
    }

    private write(message: string): void {
        this.output.write(message);
    }

    private createReadlineInstance(): readline.Interface {
        return readline.createInterface({
            input: this.input,
            output: this.output,
        });
    }
}
