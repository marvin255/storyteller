import type { Id } from '../../Shared/Id.js';
import type { Story } from './Story.js';

/**
 * Provides access to persisted conversation stories.
 */
export interface StoryRepository {
    /** Find a story by its unique identifier. */
    findStoryById(id: Id): Promise<Story | null>;
}
