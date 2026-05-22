import { IOChannel } from './contracts/IO/IOChannel.js';
import { IOChannelConsole } from './IOChannel/console/IOChannelConsole.js';

const channel: IOChannel = new IOChannelConsole();
channel.attach();
