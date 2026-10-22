import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

import type { LoggedIOMessageType } from '../../../Contracts/Domain/LoggedIOMessage/LoggedIOMessageType.js';

export const LOGGED_IO_MESSAGE_TABLE = 'io_message';

export interface LoggedIOMessageTable {
    id: Generated<number>;
    messageId: string;
    externalId: string;
    userId: string;
    content: string;
    createdAt: Date;
    storyId: number | null;
    isHandled: boolean;
    type: LoggedIOMessageType;
}

export type KyselyLoggedIOMessage = Selectable<LoggedIOMessageTable>;
export type NewKyselyLoggedIOMessage = Insertable<LoggedIOMessageTable>;
export type KyselyLoggedIOMessageUpdate = Updateable<LoggedIOMessageTable>;
