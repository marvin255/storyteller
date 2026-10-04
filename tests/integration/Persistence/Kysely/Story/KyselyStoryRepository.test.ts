import { beforeEach, describe, expect, test } from '@jest/globals';

import type { StoryStatus } from '../../../../../src/Contracts/Domain/Story/StoryStatus.js';
import { createId } from '../../../../../src/Contracts/Shared/Id.js';
import { STORY_TABLE } from '../../../../../src/Persistence/Kysely/Story/KyselyStory.js';
import { KyselyStoryRepository } from '../../../../../src/Persistence/Kysely/Story/KyselyStoryRepository.js';
import { createDeleteHelper } from '../../../../helper/Database/createDeleteHelper.js';
import { createInsertHelper } from '../../../../helper/Database/createInsertHelper.js';
import { useTestDatabase } from '../../../../helper/Database/useTestDatabase.js';

describe('KyselyStoryRepository', () => {
    const database = useTestDatabase();
    const createInDb = createInsertHelper(database);
    const deleteFromDb = createDeleteHelper(database);
    const externalIds = {
        matching: createId('KyselyStoryRepository-123'),
        other: createId('KyselyStoryRepository-456'),
    };

    beforeEach(async () => {
        for (const externalId of Object.values(externalIds)) {
            await deleteFromDb(STORY_TABLE, { externalId });
        }
    });

    test('returns null when no story exists', async () => {
        const repository = new KyselyStoryRepository(database());

        await expect(
            repository.findActiveStoryByExternalId(externalIds.matching),
        ).resolves.toBeNull();
    });

    test.each<StoryStatus>(['new', 'in-progress'])(
        'returns a %s story as a domain story',
        async (status) => {
            const db = database();
            const inserted = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status,
            });
            const repository = new KyselyStoryRepository(db);

            await expect(
                repository.findActiveStoryByExternalId(externalIds.matching),
            ).resolves.toEqual({
                id: inserted.id,
                externalId: externalIds.matching,
                status,
            });
        },
    );

    test('returns null when only closed stories match', async () => {
        const db = database();
        await createInDb(STORY_TABLE, { externalId: externalIds.matching, status: 'closed' });
        const repository = new KyselyStoryRepository(db);

        await expect(
            repository.findActiveStoryByExternalId(externalIds.matching),
        ).resolves.toBeNull();
    });

    test('returns null when an active story belongs to another external ID', async () => {
        const db = database();
        await createInDb(STORY_TABLE, {
            externalId: externalIds.other,
            status: 'new',
        });
        const repository = new KyselyStoryRepository(db);

        await expect(
            repository.findActiveStoryByExternalId(externalIds.matching),
        ).resolves.toBeNull();
    });

    test('returns the matching active story among closed and unrelated stories', async () => {
        const db = database();
        await createInDb(STORY_TABLE, { externalId: externalIds.matching, status: 'closed' });
        await createInDb(STORY_TABLE, {
            externalId: externalIds.other,
            status: 'new',
        });
        const inserted = await createInDb(STORY_TABLE, {
            externalId: externalIds.matching,
            status: 'in-progress',
        });
        const repository = new KyselyStoryRepository(db);

        await expect(repository.findActiveStoryByExternalId(externalIds.matching)).resolves.toEqual(
            {
                id: inserted.id,
                externalId: externalIds.matching,
                status: 'in-progress',
            },
        );
    });
});
