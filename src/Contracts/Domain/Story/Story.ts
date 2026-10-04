import type { Id } from '../../Shared/Id.js';
import type { StoryStatus } from './StoryStatus.js';

/**
 * Conversation context that groups user input and engine output.
 */
export interface Story {
    /** Unique identifier for this story. */
    id: number;
    /** External identifier for this story. One external id can map to multiple stories, but active story is at most one. */
    externalId: Id;
    /** Current status of the story. */
    status: StoryStatus;
}
