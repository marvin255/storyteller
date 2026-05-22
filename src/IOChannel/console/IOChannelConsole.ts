import { IOChannel } from '../../contracts/IOChannel/IOChannel.js';
import readline from 'node:readline';

export class IOChannelConsole implements IOChannel {
    attach(): void {
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

    private createReadlineInstance(): readline.Interface {
        return readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
}
