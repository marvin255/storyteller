import type { Kysely } from 'kysely';

import type { Story } from '../../../Contracts/Domain/Story/Story.js';
import type { StoryRepository } from '../../../Contracts/Domain/Story/StoryRepository.js';
import { createDateTime } from '../../../Contracts/Shared/DateTime.js';
import { createId, type Id } from '../../../Contracts/Shared/Id.js';
import { createLocale } from '../../../Contracts/Shared/Locale.js';
import type { KyselyDatabase } from '../KyselyDatabase.js';
import { type KyselyStory, STORY_TABLE } from './KyselyStory.js';

/**
 * Converts a KyselyStory entity to a domain Story entity.
 */
const convertKyselyToDomain = (kyselyStory: KyselyStory): Story => {
    return {
        id: createId(kyselyStory.id),
        locale: createLocale('en-US'),
        storyDescription: '',
        createdAt: createDateTime('2026-01-01T00:00:00Z'),
        closedAt: null,
    };
};

/**
 * A Kysely-based implementation of the StoryRepository interface.
 */
export class KyselyStoryRepository implements StoryRepository {
    constructor(private db: Kysely<KyselyDatabase>) {}

    async findStoryById(id: Id): Promise<Story | null> {
        const row = await this.db
            .selectFrom(STORY_TABLE)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? convertKyselyToDomain(row) : null;
    }
}
