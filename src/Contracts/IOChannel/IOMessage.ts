import type { Id } from '../Shared/Id.js';

/**
 * Base message structure for all I/O communication.
 * Used for both user input and engine output.
 */
export interface IOMessage {
    /** Unique identifier for this message */
    id: Id;
    /** External identifier related to a message. One external id can map to multiple stories, but active story is at most one. */
    externalId: Id;
    /** User identifier */
    userId: Id;
    /** Message content */
    content: string;
}
