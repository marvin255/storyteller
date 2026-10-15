import type { LoggedIOMessage } from '../../Contracts/Domain/LoggedIOMessage/LoggedIOMessage.js';
import type { Story } from '../../Contracts/Domain/Story/Story.js';
import type { Logger } from '../../Contracts/Logger/Logger.js';

/**
 * Represents the context in which a pipeline operation is executed.
 */
export interface PipelineOperationContext {
    /** The current state of the story being processed. */
    readonly story: Readonly<Story>;
    /** The inbound messages that triggered the pipeline operation. */
    readonly messages: readonly Readonly<LoggedIOMessage>[];
    /** The logger instance that might contain additional predefined logging information. */
    readonly logger: Logger;
}
