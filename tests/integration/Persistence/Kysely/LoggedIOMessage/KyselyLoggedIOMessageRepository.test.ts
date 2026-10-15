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
        overlapping: createId('KyselyLoggedIOMessageRepository-123-part'),
    };
    const outboundMessage: IOMessageOutbound = {
        type: 'outbound',
        messageId: createId('message-123'),
        externalId: externalIds.matching,
        userId: createId('user-456'),
        content: 'A long message\nwith Unicode: příběh. '.repeat(100),
        createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const inboundMessage: IOMessageInbound = {
        ...outboundMessage,
        type: 'inbound',
    };

    beforeEach(async () => {
        for (const externalId of Object.values(externalIds)) {
            await deleteFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId });
        }
        for (const externalId of Object.values(externalIds)) {
            await deleteFromDb(STORY_TABLE, { externalId });
        }
    });

    describe('persistIOMessages', () => {
        test('returns an empty list and leaves stored messages unchanged for an empty batch', async () => {
            const stored = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const repository = new KyselyLoggedIOMessageRepository(database());

            await expect(repository.persistIOMessages([])).resolves.toEqual([]);

            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([stored]);
        });

        test.each([
            {
                type: 'inbound',
                messages: [
                    inboundMessage,
                    {
                        ...inboundMessage,
                        messageId: createId('second-message'),
                        userId: createId('second-user'),
                        content: 'Another incoming message.',
                        createdAt: new Date('2026-01-02T03:04:05.678Z'),
                    },
                ],
                isHandled: false,
            },
            {
                type: 'outbound',
                messages: [
                    outboundMessage,
                    {
                        ...outboundMessage,
                        messageId: createId('second-message'),
                        userId: createId('second-user'),
                        content: 'Another outgoing message.',
                        createdAt: new Date('2026-01-02T03:04:05.678Z'),
                    },
                ],
                isHandled: true,
            },
        ])(
            'creates $type messages with generated IDs and no story',
            async ({ messages, isHandled }) => {
                const repository = new KyselyLoggedIOMessageRepository(database());

                const logged = await repository.persistIOMessages(messages);

                expect(logged).toHaveLength(messages.length);
                expect(logged).toEqual(
                    expect.arrayContaining(
                        messages.map((message) => ({
                            ...message,
                            id: expect.any(Number),
                            storyId: null,
                            isHandled,
                        })),
                    ),
                );
                expect(new Set(logged.map((message) => message.id)).size).toBe(messages.length);
                logged.forEach((message) => {
                    expect(message.id).toBeGreaterThan(0);
                });
                const stored = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                    externalId: externalIds.matching,
                });
                expect(stored).toHaveLength(logged.length);
                expect(stored).toEqual(expect.arrayContaining(logged));

                const repeated = await repository.persistIOMessages(messages);

                expect(repeated).toHaveLength(logged.length);
                expect(repeated).toEqual(expect.arrayContaining(logged));
                const afterRepeat = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                    externalId: externalIds.matching,
                });
                expect(afterRepeat).toHaveLength(logged.length);
                expect(afterRepeat).toEqual(expect.arrayContaining(logged));
            },
        );

        test.each([inboundMessage, outboundMessage])(
            'returns an existing $type message without replacing its contents or processing state',
            async (message) => {
                const story = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: 'closed',
                });
                const stored = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...message,
                    storyId: story.id,
                    isHandled: true,
                });
                const repository = new KyselyLoggedIOMessageRepository(database());

                await expect(
                    repository.persistIOMessages([
                        {
                            ...inboundMessage,
                            userId: createId('changed-user'),
                            content: 'Changed incoming content.',
                            createdAt: new Date('2026-02-01T00:00:00Z'),
                        },
                    ]),
                ).resolves.toEqual([stored]);
                await expect(
                    selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: stored.id }),
                ).resolves.toEqual([stored]);
            },
        );

        test('returns existing and new messages together without returning unrelated messages', async () => {
            const existing = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const unrelated = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                messageId: createId('unrequested-message'),
                storyId: null,
                isHandled: false,
            });
            const otherExternal = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                externalId: externalIds.other,
                storyId: null,
                isHandled: false,
            });
            const newMessage = { ...inboundMessage, messageId: createId('new-message') };
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.persistIOMessages([newMessage, inboundMessage]);

            const expected = {
                ...newMessage,
                id: expect.any(Number),
                storyId: null,
                isHandled: false,
            };
            expect(logged).toHaveLength(2);
            expect(logged).toEqual(expect.arrayContaining([existing, expected]));
            const stored = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                externalId: externalIds.matching,
            });
            expect(stored).toHaveLength(3);
            expect(stored).toEqual(expect.arrayContaining([existing, unrelated, expected]));
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.other }),
            ).resolves.toEqual([otherExternal]);
        });

        test('matches complete external ID and message ID pairs across a batch', async () => {
            const secondMessage = {
                ...inboundMessage,
                externalId: externalIds.other,
                messageId: createId('second-message'),
            };
            const first = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const second = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...secondMessage,
                storyId: null,
                isHandled: false,
            });
            const unrelatedFirst = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                messageId: secondMessage.messageId,
                storyId: null,
                isHandled: false,
            });
            const unrelatedSecond = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...secondMessage,
                messageId: inboundMessage.messageId,
                storyId: null,
                isHandled: false,
            });
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.persistIOMessages([secondMessage, inboundMessage]);

            expect(logged).toHaveLength(2);
            expect(logged).toEqual(expect.arrayContaining([first, second]));
            const firstExternal = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                externalId: externalIds.matching,
            });
            expect(firstExternal).toHaveLength(2);
            expect(firstExternal).toEqual(expect.arrayContaining([first, unrelatedFirst]));
            const secondExternal = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                externalId: externalIds.other,
            });
            expect(secondExternal).toHaveLength(2);
            expect(secondExternal).toEqual(expect.arrayContaining([second, unrelatedSecond]));
        });

        test('allows an existing message ID to be logged under another external ID', async () => {
            const existing = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const message = { ...inboundMessage, externalId: externalIds.other };
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.persistIOMessages([message]);

            expect(logged).toEqual([
                { ...message, id: expect.any(Number), storyId: null, isHandled: false },
            ]);
            expect(logged.map((item) => item.id)).not.toContain(existing.id);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([existing]);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.other }),
            ).resolves.toEqual(logged);
        });

        test.each([
            {
                type: 'inbound',
                messages: [inboundMessage, { ...inboundMessage, content: 'Duplicate.' }],
                isHandled: false,
            },
            {
                type: 'outbound',
                messages: [outboundMessage, { ...outboundMessage, content: 'Duplicate.' }],
                isHandled: true,
            },
        ])(
            'keeps the first new $type message when a pair is repeated in a batch',
            async ({ messages, isHandled }) => {
                const repository = new KyselyLoggedIOMessageRepository(database());

                const logged = await repository.persistIOMessages(messages);

                expect(logged).toEqual([
                    { ...messages[0], id: expect.any(Number), storyId: null, isHandled },
                ]);
                await expect(
                    selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
                ).resolves.toEqual(logged);
            },
        );

        test('returns an existing message once when a pair is repeated in a batch', async () => {
            const stored = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const repository = new KyselyLoggedIOMessageRepository(database());

            await expect(
                repository.persistIOMessages([inboundMessage, inboundMessage]),
            ).resolves.toEqual([stored]);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, { externalId: externalIds.matching }),
            ).resolves.toEqual([stored]);
        });

        test('keeps distinct pairs separate when their IDs contain overlapping hyphens', async () => {
            const existingMessage = {
                ...inboundMessage,
                externalId: externalIds.overlapping,
                messageId: createId('message'),
            };
            const existing = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...existingMessage,
                storyId: null,
                isHandled: false,
            });
            const newMessage = { ...inboundMessage, messageId: createId('part-message') };
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.persistIOMessages([existingMessage, newMessage]);

            const expected = {
                ...newMessage,
                id: expect.any(Number),
                storyId: null,
                isHandled: false,
            };
            expect(logged).toHaveLength(2);
            expect(logged).toEqual(expect.arrayContaining([existing, expected]));
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                    externalId: externalIds.matching,
                }),
            ).resolves.toEqual([expected]);
            await expect(
                selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                    externalId: externalIds.overlapping,
                }),
            ).resolves.toEqual([existing]);
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
                const inbound = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...inboundMessage,
                    storyId: null,
                    isHandled: false,
                });
                const outbound = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...outboundMessage,
                    messageId: createId('outbound-message'),
                    storyId: null,
                    isHandled: true,
                });
                const unrelated = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                    ...inboundMessage,
                    messageId: createId('unrelated-message'),
                    storyId: null,
                    isHandled: false,
                });
                const logs = [inbound, outbound].map((message) => ({
                    ...message,
                    messageId: createId(message.messageId),
                    externalId: createId(message.externalId),
                    userId: createId(message.userId),
                }));
                const ids = messages === 'logs' ? logs : [inbound.id, outbound.id];
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
            const logged = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });

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
            const logged = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const removed = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                messageId: createId('removed-message'),
                storyId: null,
                isHandled: false,
            });
            await deleteFromDb(LOGGED_IO_MESSAGE_TABLE, { id: removed.id });

            await expect(repository.markAllHandled([removed.id], row.id)).resolves.toBeUndefined();

            await expect(selectFromDb(LOGGED_IO_MESSAGE_TABLE, { id: logged.id })).resolves.toEqual(
                [logged],
            );
        });

        test('rejects marking messages handled without an existing story', async () => {
            const row = await createInDb(STORY_TABLE, {
                externalId: externalIds.matching,
                status: 'new',
            });
            const repository = new KyselyLoggedIOMessageRepository(database());
            const logged = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            await deleteFromDb(STORY_TABLE, { id: row.id });

            await expect(repository.markAllHandled([logged.id], row.id)).rejects.toMatchObject({
                code: '23503',
            });
        });
    });
});
