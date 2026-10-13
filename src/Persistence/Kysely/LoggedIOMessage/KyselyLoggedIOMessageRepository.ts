import type { Kysely } from 'kysely';

import type { LoggedIOMessage } from '../../../Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import type { LoggedIOMessageRepository } from '../../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageRepository.js';
import type { LoggedIOMessageType } from '../../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageType.js';
import type { Story } from '../../../Contracts/Domain/Story/Story.js';
import type { IOMessage } from '../../../Contracts/IOChannel/IOMessage.js';
import type { IOMessageInbound } from '../../../Contracts/IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../../Contracts/IOChannel/IOMessageOutbound.js';
import { createId, type Id } from '../../../Contracts/Shared/Id.js';
import type { KyselyDatabase } from '../KyselyDatabase.js';
import { type KyselyLoggedIOMessage, LOGGED_IO_MESSAGE_TABLE } from './KyselyLoggedIOMessage.js';

/** Converts a stored row while preserving the original message ID. */
const convertKyselyToDomain = (message: KyselyLoggedIOMessage): LoggedIOMessage => ({
    id: message.id,
    messageId: createId(message.messageId),
    externalId: createId(message.externalId),
    userId: createId(message.userId),
    content: message.content,
    storyId: message.storyId,
    isHandled: message.isHandled,
    type: message.type,
});

/** A Kysely-based implementation of the LoggedIOMessageRepository interface. */
export class KyselyLoggedIOMessageRepository implements LoggedIOMessageRepository {
    constructor(private db: Kysely<KyselyDatabase>) {}

    /** Log an unhandled inbound message without a story. */
    logMessageInbound(message: IOMessageInbound): Promise<LoggedIOMessage> {
        return this.createLoggedMessage(message, 'inbound');
    }

    /** Log an already handled outbound message without a story. */
    logMessageOutbound(message: IOMessageOutbound): Promise<LoggedIOMessage> {
        return this.createLoggedMessage(message, 'outbound');
    }

    /** Find inbound logs using message IDs or messages, ordered by row ID. */
    async findAllInboundByExternalIdAndMessageId(
        externalId: Id,
        messageIds: Id[] | IOMessage[],
    ): Promise<LoggedIOMessage[]> {
        if (messageIds.length === 0) {
            return [];
        }

        const ids = messageIds.map((item) => (typeof item === 'string' ? item : item.messageId));

        const rows = await this.db
            .selectFrom(LOGGED_IO_MESSAGE_TABLE)
            .selectAll()
            .where('externalId', '=', externalId)
            .where('messageId', 'in', ids)
            .where('type', '=', 'inbound')
            .orderBy('id', 'asc')
            .execute();

        return rows.map(convertKyselyToDomain);
    }

    /** Mark the selected logs handled and link them to the supplied story. */
    async markAllHandled(ids: number[] | LoggedIOMessage[], story: Story | number): Promise<void> {
        if (ids.length === 0) {
            return;
        }

        const logIds = ids.map((item) => (typeof item === 'number' ? item : item.id));
        const storyId = typeof story === 'number' ? story : story.id;
        if (!Number.isInteger(storyId)) {
            throw new TypeError('Story ID must be an integer.');
        }

        await this.db
            .updateTable(LOGGED_IO_MESSAGE_TABLE)
            .set({ isHandled: true, storyId })
            .where('id', 'in', logIds)
            .execute();
    }

    /** Creates a new logged message row in the database. */
    private async createLoggedMessage(
        message: IOMessage,
        type: LoggedIOMessageType,
    ): Promise<LoggedIOMessage> {
        const row = await this.db
            .insertInto(LOGGED_IO_MESSAGE_TABLE)
            .values({
                messageId: message.messageId,
                externalId: message.externalId,
                userId: message.userId,
                content: message.content,
                storyId: null,
                type,
                isHandled: type === 'outbound',
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return convertKyselyToDomain(row);
    }
}
