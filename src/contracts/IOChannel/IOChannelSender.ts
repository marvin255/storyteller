import { IOMessageOutbound } from './IOMessageOutbound.js';

export interface IOChannelSender {
    send(message: IOMessageOutbound | IOMessageOutbound[]): void;
}
