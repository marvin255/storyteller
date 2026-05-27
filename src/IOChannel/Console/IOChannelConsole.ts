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
        this.output.write('storyteller > ');
        readlineInstance.on('line', (line) => {
            if (line === '/exit') {
                readlineInstance.close();
            } else {
                this.output.write(`You entered: ${line}\n`);
                this.output.write('storyteller > ');
            }
        });
    }

    send(message: IOMessageOutbound | IOMessageOutbound[]): void {
        this.output.write(`Sending message: ${JSON.stringify(message)}\n`);
    }

    private createReadlineInstance(): readline.Interface {
        return readline.createInterface({
            input: this.input,
            output: this.output,
        });
    }
}
