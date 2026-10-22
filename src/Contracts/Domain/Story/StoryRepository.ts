import { repositoryToken } from '../../Persistence/RepositoryToken.js';
import type { Id } from '../../Shared/Id.js';
import type { Story } from './Story.js';

/**
 * Provides access to persisted conversation stories.
 */
export interface StoryRepository {
    /** Find an active story or create one, coordinating concurrent calls for the same external ID. */
    findOrCreateActiveStoryForExternalId(externalId: Id): Promise<Story>;

    /** Update an existing story by ID. A missing story is left unchanged. */
    save(story: Story): Promise<void>;
}

/**
 * A unique token used to identify the StoryRepository in the EntityManager.
 */
// eslint-disable-next-line no-redeclare
export const StoryRepository = repositoryToken<StoryRepository>('StoryRepository');
