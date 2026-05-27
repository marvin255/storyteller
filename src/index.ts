import { LLMEngine } from './Engine/LLMEngine.js';
import { IOChannelConsole } from './IOChannel/Console/IOChannelConsole.js';

const channel = new IOChannelConsole();
const engine = new LLMEngine(channel);

channel.attachEngine(engine);
