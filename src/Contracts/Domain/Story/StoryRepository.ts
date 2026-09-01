import { repositoryToken } from '../../Persistence/RepositoryToken.js';
import type { Id } from '../../Shared/Id.js';
import type { Story } from './Story.js';

/**
 * Provides access to persisted conversation stories.
 */
export interface StoryRepository {
    /** Find a story by its unique identifier. */
    findStoryById(id: Id): Promise<Story | null>;
}

/**
 * A unique token used to identify the StoryRepository in the EntityManager.
 */
// eslint-disable-next-line no-redeclare
export const StoryRepository = repositoryToken<StoryRepository>('StoryRepository');
