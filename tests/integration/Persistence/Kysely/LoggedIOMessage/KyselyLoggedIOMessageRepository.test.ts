import { beforeEach, describe, expect, test } from '@jest/globals';

import type { Story } from '../../../../../src/Contracts/Domain/Story/Story.js';
import type { IOMessageInbound } from '../../../../../src/Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../../../../src/Contracts/IOChannel/IOMessageOutbound.js';
import { createId } from '../../../../../src/Contracts/Shared/Id.js';
import { LOGGED_IO_MESSAGE_TABLE } from '../../../../../src/Persistence/Kysely/LoggedIOMessage/KyselyLoggedIOMessage.js';
import { KyselyLoggedIOMessageRepository } from '../../../../../src/Persistence/Kysely/LoggedIOMessage/KyselyLoggedIOMessageRepository.js';
import { STORY_TABLE } from '../../../../../src/Persistence/Kysely/Story/KyselyStory.js';
import { createDeleteHelper } from '../../../../helper/Database/createDeleteHelper.js';
import { createInsertHelper } from '../../../../helper/Database/createInsertHelper.js';
import { createSelectHelper } from '../../../../helper/Database/createSelectHelper.js';
import { useTestDatabase } from '../../../../helper/Database/useTestDatabase.js';

describe('KyselyLoggedIOMessageRepository', () => {
    const database = useTestDatabase();
    const createInDb = createInsertHelper(database);
    const deleteFromDb = createDeleteHelper(database);
    const selectFromDb = createSelectHelper(database);
    const externalIds = {
        matching: createId('KyselyLoggedIOMessageRepository-123'),
        other: createId('KyselyLoggedIOMessageRepository-456'),
    };
    const outboundMessage: IOMessageOutbound = {
        messageId: createId('message-123'),
        externalId: externalIds.matching,
        userId: createId('user-456'),
        content: 'A long message\nwith Unicode: příběh. '.repeat(100),
    };
    const inboundMessage: IOMessageInbound = {
        ...outboundMessage,
        createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    beforeEach(async () => {
        for (const externalId of Object.values(externalIds)) {
            await deleteFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId });
        }
        for (const externalId of Object.values(externalIds)) {
            await deleteFromDb(STORY_TABLE, { externalId });
        }
    });

    describe('logMessageInbound', () => {
        test('creates and returns an unhandled domain message with a generated ID and no story', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.logMessageInbound(inboundMessage);

            expect(logged).toEqual({
                ...outboundMessage,
                id: expect.any(Number),
                storyId: null,
                isHandled: false,
                type: 'inbound',
            });
            expect(logged.id).toBeGreaterThan(0);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([logged]);
        });

        test('rejects a repeated external ID and message ID pair', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());
            await repository.logMessageInbound(inboundMessage);

            await expect(repository.logMessageInbound(inboundMessage)).rejects.toMatchObject({
                code: '23505',
                constraint: 'io_message_external_id_message_id_index',
            });
        });

        test('allows the same message ID for different external IDs', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());

            const first = await repository.logMessageInbound(inboundMessage);
            const second = await repository.logMessageInbound({
                ...inboundMessage,
                externalId: externalIds.other,
            });

            expect(second.id).not.toBe(first.id);
            expect(second.messageId).toBe(first.messageId);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([first]);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.other }),
            ).resolves.toEqual([second]);
        });
    });

    describe('logMessageOutbound', () => {
        test('creates and returns a handled domain message with a generated ID and no story', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.logMessageOutbound(outboundMessage);

            expect(logged).toEqual({
                ...outboundMessage,
                id: expect.any(Number),
                storyId: null,
                isHandled: true,
                type: 'outbound',
            });
            expect(logged.id).toBeGreaterThan(0);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([logged]);
        });

        test('rejects a repeated external ID and message ID pair', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());
            await repository.logMessageOutbound(outboundMessage);

            await expect(repository.logMessageOutbound(outboundMessage)).rejects.toMatchObject({
                code: '23505',
                constraint: 'io_message_external_id_message_id_index',
            });
        });

        test('rejects an outbound message with the same pair as an inbound message', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());
            await repository.logMessageInbound(inboundMessage);

            await expect(repository.logMessageOutbound(outboundMessage)).rejects.toMatchObject({
                code: '23505',
                constraint: 'io_message_external_id_message_id_index',
            });
        });

        test('stores outbound and inbound messages with different message IDs separately', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());

            const inbound = await repository.logMessageInbound(inboundMessage);
            const outbound = await repository.logMessageOutbound({
                ...outboundMessage,
                messageId: createId('outbound-message'),
            });

            expect(outbound.id).not.toBe(inbound.id);
            const rows = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                externalId: externalIds.matching,
            });
            expect(rows).toHaveLength(2);
            expect(rows).toEqual(expect.arrayContaining([inbound, outbound]));
        });
    });

    describe('findAllInboundByExternalIdAndMessageId', () => {
        test('returns an empty list when no messages exist', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());

            await expect(
                repository.findAllInboundByExternalIdAndMessageId(externalIds.matching, [
                    inboundMessage.messageId,
                ]),
            ).resolves.toEqual([]);
        });

        test('returns an empty list for an empty message ID array', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());
            await repository.logMessageInbound(inboundMessage);

            await expect(
                repository.findAllInboundByExternalIdAndMessageId(externalIds.matching, []),
            ).resolves.toEqual([]);
        });

        test('returns an empty list when only outbound messages match', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());
            await repository.logMessageOutbound(outboundMessage);

            await expect(
                repository.findAllInboundByExternalIdAndMessageId(externalIds.matching, [
                    inboundMessage.messageId,
                ]),
            ).resolves.toEqual([]);
        });

        test('returns an empty list when messages belong to another external ID', async () => {
            const db = database();
            await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...outboundMessage,
                externalId: externalIds.other,
                storyId: null,
                isHandled: false,
                type: 'inbound',
            });
            const repository = new KyselyLoggedIOMessageRepository(db);

            await expect(
                repository.findAllInboundByExternalIdAndMessageId(externalIds.matching, [
                    inboundMessage.messageId,
                ]),
            ).resolves.toEqual([]);
        });

        test('returns an empty list when message IDs do not match', async () => {
            const db = database();
            await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...outboundMessage,
                messageId: createId('unrequested-message'),
                storyId: null,
                isHandled: false,
                type: 'inbound',
            });
            const repository = new KyselyLoggedIOMessageRepository(db);

            await expect(
                repository.findAllInboundByExternalIdAndMessageId(externalIds.matching, [
                    inboundMessage.messageId,
                ]),
            ).resolves.toEqual([]);
        });

        test.each(['ids', 'messages'] as const)(
            'returns matching inbound logs across stories in row ID order using %s',
            async (input) => {
                const db = database();
                const previousStory = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: 'closed',
                });
                const currentStory = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: 'new',
                });
                const secondMessageId = createId('other-message');
                const thirdMessageId = createId('third-message');
                const outboundMessageId = createId('outbound-message');
                const first = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    storyId: previousStory.id,
                    isHandled: true,
                    type: 'inbound',
                });
                const second = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    messageId: secondMessageId,
                    storyId: currentStory.id,
                    isHandled: false,
                    type: 'inbound',
                });
                const third = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    messageId: thirdMessageId,
                    storyId: currentStory.id,
                    isHandled: false,
                    type: 'inbound',
                });
                await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    messageId: createId('unrequested-message'),
                    storyId: null,
                    isHandled: false,
                    type: 'inbound',
                });
                await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    externalId: externalIds.other,
                    storyId: null,
                    isHandled: false,
                    type: 'inbound',
                });
                await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    messageId: outboundMessageId,
                    storyId: currentStory.id,
                    isHandled: true,
                    type: 'outbound',
                });
                const repository = new KyselyLoggedIOMessageRepository(db);
                const requestedIds = [
                    outboundMessageId,
                    thirdMessageId,
                    secondMessageId,
                    inboundMessage.messageId,
                ];
                const messageIds =
                    input === 'messages'
                        ? requestedIds.map((messageId) => ({ ...inboundMessage, messageId }))
                        : requestedIds;

                await expect(
                    repository.findAllInboundByExternalIdAndMessageId(
                        externalIds.matching,
                        messageIds,
                    ),
                ).resolves.toEqual([first, second, third]);
            },
        );

        test('returns each stored log once when the supplied IDs contain duplicates', async () => {
            const repository = new KyselyLoggedIOMessageRepository(database());
            const logged = await repository.logMessageInbound(inboundMessage);

            await expect(
                repository.findAllInboundByExternalIdAndMessageId(externalIds.matching, [
                    inboundMessage.messageId,
                    inboundMessage.messageId,
                ]),
            ).resolves.toEqual([logged]);
        });
    });

    describe('markAllHandled', () => {
        test.each([
            { messages: 'ids', context: 'id' },
            { messages: 'ids', context: 'story' },
            { messages: 'logs', context: 'id' },
            { messages: 'logs', context: 'story' },
        ])(
            'marks selected $messages handled using a $context context',
            async ({ messages, context }) => {
                const db = database();
                const row = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: 'new',
                });
                const story: Story = { ...row, externalId: externalIds.matching };
                const repository = new KyselyLoggedIOMessageRepository(db);
                const inbound = await repository.logMessageInbound(inboundMessage);
                const outbound = await repository.logMessageOutbound({
                    ...outboundMessage,
                    messageId: createId('outbound-message'),
                });
                const unrelated = await repository.logMessageInbound({
                    ...inboundMessage,
                    messageId: createId('unrelated-message'),
                });
                const ids = messages === 'logs' ? [inbound, outbound] : [inbound.id, outbound.id];
                const storyContext = context === 'story' ? story : story.id;

                await repository.markAllHandled(ids, storyContext);
                await repository.markAllHandled(ids, storyContext);

                await expect(
                    selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: inbound.id }),
                ).resolves.toEqual([{ ...inbound, storyId: story.id, isHandled: true }]);
                await expect(
                    selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: outbound.id }),
                ).resolves.toEqual([{ ...outbound, storyId: story.id, isHandled: true }]);
                await expect(
                    selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: unrelated.id }),
                ).resolves.toEqual([unrelated]);
            },
        );

        test('leaves stored messages unchanged for an empty log list', async () => {
            const row = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'new',
            });
            const repository = new KyselyLoggedIOMessageRepository(database());
            const logged = await repository.logMessageInbound(inboundMessage);

            await expect(repository.markAllHandled([], row.id)).resolves.toBeUndefined();

            await expect(selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: logged.id })).resolves.toEqual(
                [logged],
            );
        });

        test('leaves other messages unchanged when the requested log no longer exists', async () => {
            const row = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'new',
            });
            const repository = new KyselyLoggedIOMessageRepository(database());
            const logged = await repository.logMessageInbound(inboundMessage);
            const removed = await repository.logMessageInbound({
                ...inboundMessage,
                messageId: createId('removed-message'),
            });
            await deleteFromDb(LOGGED_IO_MESSAGE_TABLE, { id: removed.id });

            await expect(repository.markAllHandled([removed.id], row.id)).resolves.toBeUndefined();

            await expect(selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: logged.id })).resolves.toEqual(
                [logged],
            );
        });

        test.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
            'rejects a non-integer story ID %p before updating messages',
            async (storyId) => {
                const repository = new KyselyLoggedIOMessageRepository(database());
                const logged = await repository.logMessageInbound(inboundMessage);

                await expect(repository.markAllHandled([logged], storyId)).rejects.toThrow(
                    'Story ID must be an integer.',
                );

                await expect(
                    selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: logged.id }),
                ).resolves.toEqual([logged]);
            },
        );

        test('rejects marking messages handled without an existing story', async () => {
            const row = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'new',
            });
            const repository = new KyselyLoggedIOMessageRepository(database());
            const logged = await repository.logMessageInbound(inboundMessage);
            await deleteFromDb(STORY_TABLE, { id: row.id });

            await expect(repository.markAllHandled([logged], row.id)).rejects.toMatchObject({
                code: '23503',
            });
        });
    });
});
