import type { Kysely } from 'kysely';

import type { Story } from '../../../Contracts/Domain/Story/Story.js';
import type { StoryRepository } from '../../../Contracts/Domain/Story/StoryRepository.js';
import { createId, type Id } from '../../../Contracts/Shared/Id.js';
import type { KyselyDatabase } from '../KyselyDatabase.js';
import { type KyselyStory, STORY_TABLE } from './KyselyStory.js';

/**
 * Converts a KyselyStory entity to a domain Story entity.
 */
const convertKyselyToDomain = (kyselyStory: KyselyStory): Story => {
    return {
        id: kyselyStory.id,
        externalId: createId(kyselyStory.externalId),
        status: kyselyStory.status,
    };
};

/**
 * A Kysely-based implementation of the StoryRepository interface.
 */
export class KyselyStoryRepository implements StoryRepository {
    constructor(private db: Kysely<KyselyDatabase>) {}

    async findActiveStoryByExternalId(externalId: Id): Promise<Story | null> {
        const row = await this.db
            .selectFrom(STORY_TABLE)
            .selectAll()
            .where('externalId', '=', externalId)
            .where('status', '!=', 'closed')
            .executeTakeFirst();

        return row ? convertKyselyToDomain(row) : null;
    }
}
