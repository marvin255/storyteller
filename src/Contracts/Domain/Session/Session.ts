import type { DateTime } from '../../Shared/DateTime.js';
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
    /** The locale used for this session. */
    locale: Locale;
    /** Description of the story this session is about. */
    storyDescription: string;
    /** When this session was created. */
    createdAt: DateTime;
    /** When this session was closed, or null while it is still open. */
    closedAt: DateTime | null;
}
