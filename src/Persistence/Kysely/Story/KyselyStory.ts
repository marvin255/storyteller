import type { Generated, Insertable, Selectable, Updateable } from 'kysely';

import type { StoryStatus } from '../../../Contracts/Domain/Story/StoryStatus.js';

export const STORY_TABLE = 'story';

export interface StoryTable {
    id: Generated<number>;
    externalId: string;
    status: StoryStatus;
}

export type KyselyStory = Selectable<StoryTable>;
export type NewKyselyStory = Insertable<StoryTable>;
export type KyselyStoryUpdate = Updateable<StoryTable>;
