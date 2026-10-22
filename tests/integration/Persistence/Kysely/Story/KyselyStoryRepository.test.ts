import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import type { Kysely } from 'kysely';

import type { Story } from '../../../../../src/Contracts/Domain/Story/Story.js';
import type { StoryStatus } from '../../../../../src/Contracts/Domain/Story/StoryStatus.js';
import { createId } from '../../../../../src/Contracts/Shared/Id.js';
import type { KyselyDatabase } from '../../../../../src/Persistence/Kysely/KyselyDatabase.js';
import { STORY_TABLE } from '../../../../../src/Persistence/Kysely/Story/KyselyStory.js';
import { KyselyStoryRepository } from '../../../../../src/Persistence/Kysely/Story/KyselyStoryRepository.js';
import { createDeleteHelper } from '../../../../helper/Database/createDeleteHelper.js';
import { createInsertHelper } from '../../../../helper/Database/createInsertHelper.js';
import { createSelectHelper } from '../../../../helper/Database/createSelectHelper.js';
import { createTestDatabase } from '../../../../helper/Database/createTestDatabase.js';

describe('KyselyStoryRepository', () => {
    // The repository owns its transaction, so fixtures must be committed before calls.
    let db: Kysely<KyselyDatabase>;
    const database = () => db;
    const createInDb = createInsertHelper(database);
    const deleteFromDb = createDeleteHelper(database);
    const selectFromDb = createSelectHelper(database);
    const externalIds = {
        matching: createId('KyselyStoryRepository-123'),
        other: createId('KyselyStoryRepository-456'),
    };

    beforeAll(async () => {
        db = await createTestDatabase();
    });

    const cleanUpStories = async () => {
        for (const externalId of Object.values(externalIds)) {
            await deleteFromDb(STORY_TABLE, { externalId });
        }
    };

    beforeEach(cleanUpStories);
    afterEach(cleanUpStories);

    afterAll(async () => {
        await db.destroy();
    });

    describe('save', () => {
        test.each<StoryStatus>(['new', 'in-progress', 'closed'])(
            'persists the %s status only for the requested story ID',
            async (status) => {
                const stored = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: status === 'closed' ? 'new' : 'closed',
                });
                const sameExternalId = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: 'closed',
                });
                const unrelated = await createInDb(STORY_TABLE, {
                    externalId: externalIds.other,
                    status: 'new',
                });
                const repository = new KyselyStoryRepository(database());
                const story: Story = { ...stored, externalId: externalIds.matching, status };

                await expect(repository.save(story)).resolves.toBeUndefined();
                await repository.save(story);

                const matching = await selectFromDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                });
                expect(matching).toHaveLength(2);
                expect(matching).toEqual(expect.arrayContaining([story, sameExternalId]));
                await expect(
                    selectFromDb(STORY_TABLE, { externalId: externalIds.other }),
                ).resolves.toEqual([unrelated]);
            },
        );

        test('persists a changed external ID and status without changing the story ID', async () => {
            const stored = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'new',
            });
            const repository = new KyselyStoryRepository(database());
            const story: Story = {
                ...stored,
                externalId: externalIds.other,
                status: 'in-progress',
            };

            await repository.save(story);

            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([]);
            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.other }),
            ).resolves.toEqual([story]);
        });

        test('does not insert a missing story or update another story with the same external ID', async () => {
            const stored = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'new',
            });
            const removed = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'closed',
            });
            await deleteFromDb(STORY_TABLE, { id: removed.id });
            const repository = new KyselyStoryRepository(database());

            await expect(
                repository.save({
                    ...removed,
                    externalId: externalIds.matching,
                    status: 'in-progress',
                }),
            ).resolves.toBeUndefined();

            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([stored]);
        });

        test('allows a new active story to be created after saving a closed status', async () => {
            const repository = new KyselyStoryRepository(database());
            const story = await repository.findOrCreateActiveStoryForExternalId(
                externalIds.matching,
            );
            const closed: Story = { ...story, status: 'closed' };

            await repository.save(closed);

            const active = await repository.findOrCreateActiveStoryForExternalId(
                externalIds.matching,
            );
            expect(active.id).not.toBe(closed.id);
            expect(active.status).toBe('new');
            const stored = await selectFromDb(STORY_TABLE, { externalId: externalIds.matching });
            expect(stored).toHaveLength(2);
            expect(stored).toEqual(expect.arrayContaining([closed, active]));
        });
    });

    describe('findOrCreateActiveStoryForExternalId', () => {
        test('creates and returns a new domain story with a generated ID when none exists', async () => {
            const repository = new KyselyStoryRepository(database());

            const story = await repository.findOrCreateActiveStoryForExternalId(
                externalIds.matching,
            );

            expect(story).toEqual({
                id: expect.any(Number),
                externalId: externalIds.matching,
                status: 'new',
            });
            expect(story.id).toBeGreaterThan(0);
            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([story]);
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
                    repository.findOrCreateActiveStoryForExternalId(externalIds.matching),
                ).resolves.toEqual({
                    id: inserted.id,
                    externalId: externalIds.matching,
                    status,
                });
                await expect(
                    selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
                ).resolves.toEqual([inserted]);
            },
        );

        test('creates a new story when only closed stories match', async () => {
            const db = database();
            const closed = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'closed',
            });
            const repository = new KyselyStoryRepository(db);

            const story = await repository.findOrCreateActiveStoryForExternalId(
                externalIds.matching,
            );

            expect(story).toEqual({
                id: expect.any(Number),
                externalId: externalIds.matching,
                status: 'new',
            });
            expect(story.id).not.toBe(closed.id);
            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual(expect.arrayContaining([closed, story]));
        });

        test('creates a separate story when an active story belongs to another external ID', async () => {
            const db = database();
            const unrelated = await createInDb(STORY_TABLE, {
                externalId: externalIds.other,
                status: 'new',
            });
            const repository = new KyselyStoryRepository(db);

            const story = await repository.findOrCreateActiveStoryForExternalId(
                externalIds.matching,
            );

            expect(story).toEqual({
                id: expect.any(Number),
                externalId: externalIds.matching,
                status: 'new',
            });
            expect(story.id).not.toBe(unrelated.id);
            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([story]);
            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.other }),
            ).resolves.toEqual([unrelated]);
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

            await expect(
                repository.findOrCreateActiveStoryForExternalId(externalIds.matching),
            ).resolves.toEqual({
                id: inserted.id,
                externalId: externalIds.matching,
                status: 'in-progress',
            });
        });

        test('returns the same story on repeated calls', async () => {
            const repository = new KyselyStoryRepository(database());
            const story = await repository.findOrCreateActiveStoryForExternalId(
                externalIds.matching,
            );

            await expect(
                repository.findOrCreateActiveStoryForExternalId(externalIds.matching),
            ).resolves.toEqual(story);
            await expect(
                selectFromDb(STORY_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([story]);
        });
    });
});
