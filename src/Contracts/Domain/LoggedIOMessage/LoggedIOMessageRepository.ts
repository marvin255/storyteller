import type { IOMessageInbound } from '../../IOChannel/IOMessageInbound.js';
import type { IOMessageOutbound } from '../../IOChannel/IOMessageOutbound.js';
import { repositoryToken } from '../../Persistence/RepositoryToken.js';
import type { Story } from '../Story/Story.js';
import type { LoggedIOMessage } from './LoggedIOMessage.js';

/** Provides access to logged inbound and outbound messages. */
export interface LoggedIOMessageRepository {
    /**
     * Inserts multiple I/O messages if they are not already logged.
     * Returns the logged messages for the inserted rows and already logged messages.
     */
    persistIOMessages(
        messages: IOMessageInbound[] | IOMessageOutbound[],
        story?: Story | number,
    ): Promise<LoggedIOMessage[]>;

    /** Mark the selected logs handled and link them to the supplied story. */
    markAllHandled(ids: number[] | LoggedIOMessage[], story: Story | number): Promise<void>;
}

/** A unique token used to retrieve the message repository from the EntityManager. */
// eslint-disable-next-line no-redeclare
export const LoggedIOMessageRepository = repositoryToken<LoggedIOMessageRepository>(
    'LoggedIOMessageRepository',
);
