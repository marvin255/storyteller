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
                        createdAt: new Date('2025-12-31T23:59:59.678Z'),
                    },
                ],
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
                        createdAt: new Date('2025-12-31T23:59:59.678Z'),
                    },
                ],
            },
        ])(
            'creates unhandled $type messages with generated IDs and returns them by ascending creation time',
            async ({ messages }) => {
                const repository = new KyselyLoggedIOMessageRepository(database());

                const logged = await repository.persistIOMessages(messages);

                expect(logged).toHaveLength(messages.length);
                expect(logged).toEqual(
                    messages.toReversed().map((message) => ({
                        ...message,
                        id: expect.any(Number),
                        storyId: null,
                        isHandled: false,
                    })),
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

                expect(repeated).toEqual(logged);
                const afterRepeat = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                    externalId: externalIds.matching,
                });
                expect(afterRepeat).toHaveLength(logged.length);
                expect(afterRepeat).toEqual(expect.arrayContaining(logged));
            },
        );

        test.each([
            {
                messages: [
                    inboundMessage,
                    { ...inboundMessage, messageId: createId('second-message') },
                ],
                context: 'id',
            },
            {
                messages: [
                    inboundMessage,
                    { ...inboundMessage, messageId: createId('second-message') },
                ],
                context: 'story',
            },
            {
                messages: [
                    outboundMessage,
                    { ...outboundMessage, messageId: createId('second-message') },
                ],
                context: 'id',
            },
            {
                messages: [
                    outboundMessage,
                    { ...outboundMessage, messageId: createId('second-message') },
                ],
                context: 'story',
            },
        ])(
            'links new $messages.0.type messages to the supplied $context and leaves them unhandled',
            async ({ messages, context }) => {
                const row = await createInDb(STORY_TABLE, {
                    externalId: externalIds.matching,
                    status: 'new',
                });
                const story: Story = { ...row, externalId: externalIds.matching };
                const repository = new KyselyLoggedIOMessageRepository(database());

                const logged = await repository.persistIOMessages(
                    messages,
                    context === 'story' ? story : story.id,
                );

                const expected = messages.map((item) => ({
                    ...item,
                    id: expect.any(Number),
                    storyId: story.id,
                    isHandled: false,
                }));
                expect(logged).toHaveLength(expected.length);
                expect(logged).toEqual(expect.arrayContaining(expected));
                const stored = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, { storyId: story.id });
                expect(stored).toHaveLength(expected.length);
                expect(stored).toEqual(expect.arrayContaining(expected));
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
                const otherStory = await createInDb(STORY_TABLE, {
                    externalId: externalIds.other,
                    status: 'new',
                });
                const repository = new KyselyLoggedIOMessageRepository(database());

                await expect(
                    repository.persistIOMessages(
                        [
                            {
                                ...inboundMessage,
                                userId: createId('changed-user'),
                                content: 'Changed incoming content.',
                                createdAt: new Date('2026-02-01T00:00:00Z'),
                            },
                        ],
                        otherStory.id,
                    ),
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

        test('sorts existing and newly inserted messages together using their stored creation times', async () => {
            const laterMessage = {
                ...inboundMessage,
                messageId: createId('stored-later'),
                createdAt: new Date('2026-01-03T00:00:00Z'),
            };
            const later = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...laterMessage,
                storyId: null,
                isHandled: false,
            });
            const earliest = await createInDb(LOGGED_IO_MESSAGE_TABLE, {
                ...inboundMessage,
                storyId: null,
                isHandled: false,
            });
            const middleMessage = {
                ...inboundMessage,
                messageId: createId('new-middle'),
                createdAt: new Date('2026-01-02T00:00:00Z'),
            };
            const latestMessage = {
                ...inboundMessage,
                messageId: createId('new-latest'),
                createdAt: new Date('2026-01-04T00:00:00Z'),
            };
            const messages = [
                latestMessage,
                { ...laterMessage, createdAt: new Date('2025-12-01T00:00:00Z') },
                middleMessage,
                { ...inboundMessage, createdAt: new Date('2026-02-01T00:00:00Z') },
            ];
            const inputOrder = messages.slice();
            const repository = new KyselyLoggedIOMessageRepository(database());

            const logged = await repository.persistIOMessages(messages);

            expect(logged).toEqual([
                earliest,
                { ...middleMessage, id: expect.any(Number), storyId: null, isHandled: false },
                later,
                { ...latestMessage, id: expect.any(Number), storyId: null, isHandled: false },
            ]);
            expect(messages).toEqual(inputOrder);
            const stored = await selectFromDb(LOGGED_IO_MESSAGE_TABLE, {
                externalId: externalIds.matching,
            });
            expect(stored).toHaveLength(logged.length);
            expect(stored).toEqual(expect.arrayContaining(logged));
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
                messages: [
                    inboundMessage,
                    {
                        ...inboundMessage,
                        content: 'Duplicate.',
                        createdAt: new Date('2025-12-31T00:00:00Z'),
                    },
                ],
            },
            {
                type: 'outbound',
                messages: [
                    outboundMessage,
                    {
                        ...outboundMessage,
                        content: 'Duplicate.',
                        createdAt: new Date('2025-12-31T00:00:00Z'),
                    },
                ],
            },
        ])(
            'keeps the first new $type message when a pair is repeated in a batch',
            async ({ messages }) => {
                const repository = new KyselyLoggedIOMessageRepository(database());

                const logged = await repository.persistIOMessages(messages);

                expect(logged).toEqual([
                    { ...messages[0], id: expect.any(Number), storyId: null, isHandled: false },
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
