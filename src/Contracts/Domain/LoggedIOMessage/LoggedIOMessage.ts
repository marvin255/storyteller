import type { IOMessage } from '../../IOChannel/IOMessage.js';
import type { Story } from '../Story/Story.js';
import type { LoggedIOMessageType } from './LoggedIOMessageType.js';

/** A persisted message with an optional story and engine processing state. */
export interface LoggedIOMessage extends IOMessage {
    /** Database row identifier. */
    id: number;
    storyId: Story['id'] | null;
    isHandled: boolean;
    type: LoggedIOMessageType;
}
