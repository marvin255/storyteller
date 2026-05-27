/**
 * Base message structure for all I/O communication.
 * Used for both user input and engine output.
 */
export interface IOMessage {
    /** Unique identifier for this message */
    id: string;
    /** Session/conversation identifier */
    sessionId: string;
    /** User identifier */
    userId: string;
    /** Message content */
    content: string;
}
