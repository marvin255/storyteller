import type { Id } from '../../Shared/Id.js';
import type { Locale } from '../../Shared/Locale.js';

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
    /** The locale used for this session. */
    locale: Locale;
}
