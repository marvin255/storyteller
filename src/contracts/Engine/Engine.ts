import { IOMessageInbound } from '../IOChannel/IOMessageInbound.js';

/**
 * Narrative generator engine - processes user input and produces story responses.
 */
export interface Engine {
    /** Handle incoming messages from UI and generate narrative responses */
    handle(message: IOMessageInbound | IOMessageInbound[]): void;
}
