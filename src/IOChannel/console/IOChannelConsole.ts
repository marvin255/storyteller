import readline from 'node:readline';

import { Engine } from '../../contracts/Engine/Engine.js';
import { IOChannelListener } from '../../contracts/IOChannel/IOChannelListener.js';
import { IOChannelSender } from '../../contracts/IOChannel/IOChannelSender.js';
import { IOMessageOutbound } from '../../contracts/IOChannel/IOMessageOutbound.js';

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
