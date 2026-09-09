import type { Insertable, Selectable, Updateable } from 'kysely';

export const STORY_TABLE = 'story';

export interface StoryTable {
    id: string;
}

export type KyselyStory = Selectable<StoryTable>;
export type NewKyselyStory = Insertable<StoryTable>;
export type KyselyStoryUpdate = Updateable<StoryTable>;
