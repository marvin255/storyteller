import type { Engine } from './Contracts/Engine/Engine.js';
import type { IOChannelListener } from './Contracts/IOChannel/IOChannelListener.js';
import { IOChannelConsole } from './IOChannel/Console/IOChannelConsole.js';

const engine: Engine = {
    handle: (_message) => {
        // The console channel currently echoes input directly.
    },
};
const channel: IOChannelListener = new IOChannelConsole();

channel.attachEngine(engine);
