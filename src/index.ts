import { IOChannel } from './contracts/IOChannel/IOChannel.js';
import { IOChannelConsole } from './IOChannel/console/IOChannelConsole.js';

const channel: IOChannel = new IOChannelConsole();

channel.attach();
