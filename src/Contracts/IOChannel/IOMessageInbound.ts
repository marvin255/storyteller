import type { IOMessage } from './IOMessage.js';

/**
 * Message from user/UI to the narrative engine.
 */
export type IOMessageInbound = IOMessage & {
    /** Timestamp when the message was created */
    createdAt: Date;
};
