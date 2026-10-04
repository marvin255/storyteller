import type { Kysely } from 'kysely';

import type { KyselyDatabase } from '../Persistence/Kysely/KyselyDatabase.js';

const STORY_TABLE = 'story';

export async function up(db: Kysely<KyselyDatabase>): Promise<void> {
    await db.schema
        .createTable(STORY_TABLE)
        .addColumn('id', 'integer', (col) => col.generatedByDefaultAsIdentity().primaryKey())
        .addColumn('externalId', 'varchar(50)', (col) => col.notNull())
        .addColumn('status', 'varchar(50)', (col) => col.notNull())
        .execute();

    await db.schema
        .createIndex(`${STORY_TABLE}_external_id_index`)
        .on(STORY_TABLE)
        .column('externalId')
        .execute();

    await db.schema
        .createIndex(`${STORY_TABLE}_status_index`)
        .on(STORY_TABLE)
        .column('status')
        .execute();
}

export async function down(db: Kysely<KyselyDatabase>): Promise<void> {
    await db.schema.dropIndex(`${STORY_TABLE}_external_id_index`).execute();
    await db.schema.dropIndex(`${STORY_TABLE}_status_index`).execute();
    await db.schema.dropTable(STORY_TABLE).execute();
}
