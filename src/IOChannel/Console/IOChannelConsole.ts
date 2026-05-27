import readline from 'node:readline';

import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOChannelListener } from '../../Contracts/IOChannel/IOChannelListener.js';
import type { IOChannelSender } from '../../Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageOutbound } from '../../Contracts/IOChannel/IOMessageOutbound.js';

export class IOChannelConsole implements IOChannelListener, IOChannelSender {
    attachEngine(_engine: Engine): void {
        const readlineInstance = this.createReadlineInstance();
        process.stdout.write('storyteller > ');
        readlineInstance.on('line', (line) => {
            if (line === '/exit') {
                readlineInstance.close();
            } else {
                process.stdout.write(`You entered: ${line}\n`);
                process.stdout.write('storyteller > ');
            }
        });
    }

    send(message: IOMessageOutbound | IOMessageOutbound[]): void {
        process.stdout.write(`Sending message: ${JSON.stringify(message)}\n`);
    }

    private createReadlineInstance(): readline.Interface {
        return readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
}
