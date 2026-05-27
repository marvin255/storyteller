import type { Engine } from './contracts/Engine/Engine.js';
import type { IOChannelListener } from './contracts/IOChannel/IOChannelListener.js';
import { IOChannelConsole } from './IOChannel/console/IOChannelConsole.js';

const engine: Engine = {
    handle: (_message) => {
        // The console channel currently echoes input directly.
    },
};
const channel: IOChannelListener = new IOChannelConsole();

channel.attachEngine(engine);
