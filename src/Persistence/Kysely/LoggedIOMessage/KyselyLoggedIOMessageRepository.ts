import type { Expression, Kysely, SqlBool } from 'kysely';

import type { LoggedIOMessage } from '../../../Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import type { LoggedIOMessageRepository } from '../../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageRepository.js';
import type { Story } from '../../../Contracts/Domain/Story/Story.js';
import type { IOMessage } from '../../../Contracts/IOChannel/IOMessage.js';
import type { IOMessageInbound } from '../../../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../../Contracts/IOChannel/IOMessageOutbound.js';
import { createId } from '../../../Contracts/Shared/Id.js';
import type { KyselyDatabase } from '../KyselyDatabase.js';
import {
    type KyselyLoggedIOMessage,
    LOGGED_IO_MESSAGE_TABLE,
    type NewKyselyLoggedIOMessage,
} from './KyselyLoggedIOMessage.js';

/** Converts a stored row while preserving the original message ID. */
const convertKyselyToDomain = (message: KyselyLoggedIOMessage): LoggedIOMessage => ({
    id: message.id,
    messageId: createId(message.messageId),
    externalId: createId(message.externalId),
    userId: createId(message.userId),
    content: message.content,
    createdAt: message.createdAt,
    storyId: message.storyId,
    isHandled: message.isHandled,
    type: message.type,
});

/** A Kysely-based implementation of the LoggedIOMessageRepository interface. */
export class KyselyLoggedIOMessageRepository implements LoggedIOMessageRepository {
    constructor(private db: Kysely<KyselyDatabase>) {}

    async persistIOMessages(
        messages: IOMessageInbound[] | IOMessageOutbound[],
        story?: Story | number,
    ): Promise<LoggedIOMessage[]> {
        if (messages.length === 0) {
            return Promise.resolve([]);
        }

        const deduplicatedMessagesKeys = new Set();
        const deduplicatedMessages = messages.filter((message) => {
            const key = this.createMessageKey(message);
            if (deduplicatedMessagesKeys.has(key)) {
                return false;
            }
            deduplicatedMessagesKeys.add(this.createMessageKey(message));
            return true;
        });

        let storyId: number | null;
        if (story) {
            storyId = typeof story === 'number' ? story : story.id;
        } else {
            storyId = null;
        }

        const newMessages: NewKyselyLoggedIOMessage[] = deduplicatedMessages.map((message) => ({
            messageId: message.messageId,
            externalId: message.externalId,
            userId: message.userId,
            content: message.content,
            createdAt: message.createdAt,
            storyId: storyId,
            type: message.type,
            isHandled: false,
        }));

        await this.db
            .insertInto(LOGGED_IO_MESSAGE_TABLE)
            .values(newMessages)
            .onConflict((oc) => oc.columns(['externalId', 'messageId']).doNothing())
            .execute();

        const rows = await this.db
            .selectFrom(LOGGED_IO_MESSAGE_TABLE)
            .selectAll()
            .where((eb) => {
                const ors: Expression<SqlBool>[] = [];
                deduplicatedMessages.forEach(({ externalId, messageId }) => {
                    ors.push(
                        eb.and([
                            eb('externalId', '=', externalId),
                            eb('messageId', '=', messageId),
                        ]),
                    );
                });
                return eb.or(ors);
            })
            .orderBy('createdAt', 'asc')
            .execute();

        return rows.map(convertKyselyToDomain);
    }

    async markAllHandled(ids: number[] | LoggedIOMessage[], story: Story | number): Promise<void> {
        if (ids.length === 0) {
            return;
        }

        const logIds = ids.map((item) => (typeof item === 'number' ? item : item.id));
        const storyId = typeof story === 'number' ? story : story.id;
        await this.db
            .updateTable(LOGGED_IO_MESSAGE_TABLE)
            .set({ isHandled: true, storyId })
            .where('id', 'in', logIds)
            .execute();
    }

    private createMessageKey({ externalId, messageId }: IOMessage | KyselyLoggedIOMessage): string {
        return JSON.stringify([externalId, messageId]);
    }
}
