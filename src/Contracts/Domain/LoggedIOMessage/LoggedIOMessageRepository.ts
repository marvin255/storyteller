import type { IOMessage } from '../../IOChannel/IOMessage.js';
import type { IOMessageInbound } from '../../IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../IOChannel/IOMessageOutbound.js';
import { repositoryToken } from '../../Persistence/RepositoryToken.js';
import type { Id } from '../../Shared/Id.js';
import type { Story } from '../Story/Story.js';
import type { LoggedIOMessage } from './LoggedIOMessage.js';

/** Provides access to logged inbound and outbound messages. */
export interface LoggedIOMessageRepository {
    /** Log an unhandled inbound message without a story. */
    logMessageInbound(message: IOMessageInbound): Promise<LoggedIOMessage>;

    /** Log an already handled outbound message without a story. */
    logMessageOutbound(message: IOMessageOutbound): Promise<LoggedIOMessage>;

    /** Find inbound logs using message IDs or messages, ordered by row ID. */
    findAllInboundByExternalIdAndMessageId(
        externalId: Id,
        messageIds: Id[] | IOMessage[],
    ): Promise<LoggedIOMessage[]>;

    /** Mark the selected logs handled and link them to the supplied story. */
    markAllHandled(ids: number[] | LoggedIOMessage[], story: Story | number): Promise<void>;
}

/** A unique token used to retrieve the message repository from the EntityManager. */
// eslint-disable-next-line no-redeclare
export const LoggedIOMessageRepository = repositoryToken<LoggedIOMessageRepository>(
    'LoggedIOMessageRepository',
);
