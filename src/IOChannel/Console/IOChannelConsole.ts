import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import { createId, createRandomId, type Id } from '../../Contracts/Data/Id.js';
import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOChannelListener } from '../../Contracts/IOChannel/IOChannelListener.js';
import type { IOChannelSender } from '../../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../Contracts/IOChannel/IOMessageOutbound.js';

type IOChannelConsoleCommand = Readonly<{
    isApllicableToString: (line: string) => boolean;
    apply: (line: string, readlineInstance: readline.Interface) => void;
}>;

export class IOChannelConsole implements IOChannelListener, IOChannelSender {
    private readonly commands: readonly IOChannelConsoleCommand[] = [
        {
            isApllicableToString: (line: string) => line === '/exit',
            apply: (_line: string, readlineInstance: readline.Interface) => {
                readlineInstance.close();
            },
        },
        {
            isApllicableToString: (line: string) => /^\/user-id\s+[A-Za-z0-9_-]+$/u.test(line),
            apply: (line: string) => {
                this.userId = createId(line.split(/\s+/u)[1]);
            },
        },
        {
            isApllicableToString: (line: string) => /^\/session-id\s+[A-Za-z0-9_-]+$/u.test(line),
            apply: (line: string) => {
                this.sessionId = createId(line.split(/\s+/u)[1]);
            },
        },
    ];

    constructor(
        private readonly input: Readable = process.stdin,
        private readonly output: Writable = process.stdout,
        private readonly channelId: Id = createId('storyteller'),
        private userId: Id = createId('user'),
        private sessionId: Id = createId('session'),
    ) {}

    attachEngine(engine: Engine): void {
        const readlineInstance = this.createReadlineInstance();

        this.write(this.formatInboundMessage(''));

        readlineInstance.on('line', (line) => {
            this.handleLine(line, readlineInstance, engine);
            this.write(this.formatInboundMessage(''));
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

    private handleLine(line: string, readlineInstance: readline.Interface, engine: Engine): void {
        for (const command of this.commands) {
            if (command.isApllicableToString(line)) {
                command.apply(line, readlineInstance);
                return;
            }
        }
        engine.handle(this.createInboundMessage(line));
    }

    private createInboundMessage(message: string): IOMessageInbound {
        return {
            id: createRandomId(),
            sessionId: this.sessionId,
            userId: this.userId,
            content: message,
        };
    }

    private formatInboundMessage(message: string): string {
        return this.formatMessage(this.userId, message);
    }

    private formatOutboundMessage(message: IOMessageOutbound | string): string {
        const content = typeof message === 'string' ? message : message.content;
        return this.formatMessage(this.channelId, content);
    }

    private formatMessage(sender: string, message: string): string {
        return `${sender} (${this.sessionId}) > ${message}\n`;
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
