import type { Id } from '../Data/Id.js';

/**
 * Base message structure for all I/O communication.
 * Used for both user input and engine output.
 */
export interface IOMessage {
    /** Unique identifier for this message */
    id: Id;
    /** Session/conversation identifier */
    sessionId: Id;
    /** User identifier */
    userId: Id;
    /** Message content */
    content: string;
}
