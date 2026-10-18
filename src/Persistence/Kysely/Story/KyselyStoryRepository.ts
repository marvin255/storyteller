import { createHash } from 'node:crypto';

import { type Kysely, sql } from 'kysely';

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

    async findOrCreateActiveStoryForExternalId(externalId: Id): Promise<Story> {
        // Namespace and hash the external ID into a stable signed 64-bit advisory lock key.
        const lockKey = createHash('sha256')
            .update(`story:${externalId}`)
            .digest()
            .readBigInt64BE(0)
            .toString();

        return this.db
            .transaction()
            .setIsolationLevel('read committed')
            .execute(async (trx) => {
                await sql`SET LOCAL lock_timeout = '5s'`.execute(trx);
                await sql`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`.execute(trx);

                const existing = await trx
                    .selectFrom(STORY_TABLE)
                    .selectAll()
                    .where('externalId', '=', externalId)
                    .where('status', '!=', 'closed')
                    .executeTakeFirst();

                if (existing) {
                    return convertKyselyToDomain(existing);
                }

                const created = await trx
                    .insertInto(STORY_TABLE)
                    .values({ externalId, status: 'new' })
                    .returningAll()
                    .executeTakeFirstOrThrow();

                return convertKyselyToDomain(created);
            });
    }
}
