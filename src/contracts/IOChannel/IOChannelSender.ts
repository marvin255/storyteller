import { IOMessageOutbound } from './IOMessageOutbound.js';

/**
 * UI-agnostic interface for sending messages to users.
 * Implementations route to different UI channels (console, web, chat bot).
 */
export interface IOChannelSender {
    /** Send narrative responses to the user via the UI channel */
    send(message: IOMessageOutbound | IOMessageOutbound[]): void;
}
