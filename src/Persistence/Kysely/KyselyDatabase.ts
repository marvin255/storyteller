import type { STORY_TABLE, StoryTable } from './Story/KyselyStory.js';

export interface KyselyDatabase {
    [STORY_TABLE]: StoryTable;
}
