import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOChannelListener } from '../../Contracts/IOChannel/IOChannelListener.js';
import type { IOChannelSender } from '../../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageOutbound } from '../../Contracts/IOChannel/IOMessageOutbound.js';

export class IOChannelConsole implements IOChannelListener, IOChannelSender {
    constructor(
        private readonly input: Readable = process.stdin,
        private readonly output: Writable = process.stdout,
    ) {}

    attachEngine(_engine: Engine): void {
        const readlineInstance = this.createReadlineInstance();
        this.write('storyteller > ');
        readlineInstance.on('line', (line) => {
            if (line === '/exit') {
                readlineInstance.close();
            } else {
                this.write(this.formatInboundMessage(line));
                this.write('storyteller > ');
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
        return `You entered: ${message}\n`;
    }

    private formatOutboundMessage(message: IOMessageOutbound): string {
        return `${message.content}\n`;
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
