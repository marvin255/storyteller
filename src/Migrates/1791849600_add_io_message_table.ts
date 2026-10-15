import type { Kysely } from 'kysely';

import type { KyselyDatabase } from '../Persistence/Kysely/KyselyDatabase.js';

const LOGGED_IO_MESSAGE_TABLE = 'io_message';

export async function up(db: Kysely<KyselyDatabase>): Promise<void> {
    await db.schema
        .createTable(LOGGED_IO_MESSAGE_TABLE)
        .addColumn('id', 'integer', (col) => col.generatedByDefaultAsIdentity().primaryKey())
        .addColumn('messageId', 'varchar(50)', (col) => col.notNull())
        .addColumn('externalId', 'varchar(50)', (col) => col.notNull())
        .addColumn('userId', 'varchar(50)', (col) => col.notNull())
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('createdAt', 'timestamptz', (col) => col.notNull())
        .addColumn('storyId', 'integer', (col) => col.references('story.id'))
        .addColumn('isHandled', 'boolean', (col) => col.notNull())
        .addColumn('type', 'varchar(50)', (col) => col.notNull())
        .execute();

    await db.schema
        .createIndex(`${LOGGED_IO_MESSAGE_TABLE}_external_id_message_id_index`)
        .unique()
        .on(LOGGED_IO_MESSAGE_TABLE)
        .columns(['externalId', 'messageId'])
        .execute();

    await db.schema
        .createIndex(`${LOGGED_IO_MESSAGE_TABLE}_story_id_index`)
        .on(LOGGED_IO_MESSAGE_TABLE)
        .column('storyId')
        .execute();
}

export async function down(db: Kysely<KyselyDatabase>): Promise<void> {
    await db.schema.dropIndex(`${LOGGED_IO_MESSAGE_TABLE}_external_id_message_id_index`).execute();
    await db.schema.dropIndex(`${LOGGED_IO_MESSAGE_TABLE}_story_id_index`).execute();
    await db.schema.dropTable(LOGGED_IO_MESSAGE_TABLE).execute();
}
