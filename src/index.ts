import { IOChannelListener } from './contracts/IOChannel/IOChannelListener.js';
import { IOChannelConsole } from './IOChannel/console/IOChannelConsole.js';

const channel: IOChannelListener = new IOChannelConsole();

channel.attachEngine();
