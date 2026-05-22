import { IOChannel } from "#storyteller/contracts/IO/IOChannel.js";
import { IOChannelConsole } from "#storyteller/IOChannel/console/IOChannelConsole.js";

const channel: IOChannel = new IOChannelConsole();
channel.attach();