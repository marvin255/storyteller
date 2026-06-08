import type { Id } from '../../Shared/Id.js';

/**
 * Conversation context that groups user input and engine output.
 */
export interface Session {
    /** Unique identifier for this session. */
    id: Id;
    /** The user associated with this session. */
    userId: Id;
    /** Indicates whether this session is currently active. */
    isActive: boolean;
}
