import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import { createId, createRandomId, type Id } from '../../Contracts/Data/Id.js';
import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOChannelListener } from '../../Contracts/IOChannel/IOChannelListener.js';
import type { IOChannelSender } from '../../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../Contracts/IOChannel/IOMessageOutbound.js';

type IOChannelConsoleCommand = Readonly<{
    isApplicable: (line: string) => boolean;
    apply: (line: string, readlineInstance: readline.Interface) => void;
}>;

export class IOChannelConsole implements IOChannelListener, IOChannelSender {
    private readonly commands: readonly IOChannelConsoleCommand[] = [
        {
            isApplicable: (line: string) => line === '/exit',
            apply: (_line: string, readlineInstance: readline.Interface) => {
                readlineInstance.close();
            },
        },
        {
            isApplicable: (line: string) => /^\/user-id\s+[A-Za-z0-9_-]+$/u.test(line),
            apply: (line: string) => {
                this.userId = createId(line.split(/\s+/u)[1]);
                this.writetMessagePlaceholder();
            },
        },
        {
            isApplicable: (line: string) => /^\/session-id\s+[A-Za-z0-9_-]+$/u.test(line),
            apply: (line: string) => {
                this.sessionId = createId(line.split(/\s+/u)[1]);
                this.writetMessagePlaceholder();
            },
        },
    ];

    constructor(
        private readonly input: Readable = process.stdin,
        private readonly output: Writable = process.stdout,
        private readonly channelId: Id = createId('storyteller'),
        private userId: Id = createId('console-user'),
        private sessionId: Id = createId('story'),
    ) {}

    attachEngine(engine: Engine): void {
        const readlineInstance = this.createReadlineInstance();

        this.writetMessagePlaceholder();

        readlineInstance.on('line', (line) => {
            this.handleLine(line, readlineInstance, engine);
        });
    }

    send(message: IOMessageOutbound | IOMessageOutbound[]): void {
        const messages = Array.isArray(message) ? message : [message];
        messages
            .map((outboundMessage) => this.formatOutboundMessage(outboundMessage))
            .forEach((formattedMessage) => {
                this.write(formattedMessage);
            });
        this.writetMessagePlaceholder();
    }

    private handleLine(line: string, readlineInstance: readline.Interface, engine: Engine): void {
        const trimmedLine = line.trim();
        for (const command of this.commands) {
            if (command.isApplicable(trimmedLine)) {
                command.apply(trimmedLine, readlineInstance);
                return;
            }
        }
        engine.handle(this.createInboundMessage(trimmedLine));
    }

    private createInboundMessage(message: string): IOMessageInbound {
        return {
            id: createRandomId(),
            sessionId: this.sessionId,
            userId: this.userId,
            content: message,
        };
    }

    private formatOutboundMessage(message: IOMessageOutbound): string {
        return this.formatMessage(this.channelId, message.sessionId, message.content);
    }

    private formatMessage(sender: string, sessionId: string, message: string): string {
        return `${sender} (${sessionId}) > ${message}\n`;
    }

    private writetMessagePlaceholder(): void {
        this.write(`${this.userId} (${this.sessionId}) > `);
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
