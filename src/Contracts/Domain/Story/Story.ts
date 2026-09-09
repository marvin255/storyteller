import type { DateTime } from '../../Shared/DateTime.js';
import type { Id } from '../../Shared/Id.js';
import type { Locale } from '../../Shared/Locale.js';

/**
 * Conversation context that groups user input and engine output.
 */
export interface Story {
    /** Unique identifier for this story. */
    id: Id;
    /** The locale used for this story. */
    locale: Locale;
    /** Description of the story this story is about. */
    storyDescription: string;
    /** When this story was created. */
    createdAt: DateTime;
    /** When this story was closed, or null while it is still open. */
    closedAt: DateTime | null;
}
