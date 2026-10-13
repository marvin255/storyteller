import type {
    LOGGED_IO_MESSAGE_TABLE,
    LoggedIOMessageTable,
} from './LoggedIOMessage/KyselyLoggedIOMessage.js';
import type { STORY_TABLE, StoryTable } from './Story/KyselyStory.js';

export interface KyselyDatabase {
    [STORY_TABLE]: StoryTable;
    [LOGGED_IO_MESSAGE_TABLE]: LoggedIOMessageTable;
}
