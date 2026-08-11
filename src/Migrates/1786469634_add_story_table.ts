import type { Kysely } from 'kysely';

import type { KyselyDatabase } from '../Persistence/Kysely/KyselyDatabase.js';

export async function up(db: Kysely<KyselyDatabase>): Promise<void> {
    await db.schema
        .createTable('story')
        .addColumn('id', 'varchar(255)', (col) => col.primaryKey().notNull())
        .execute();
}

export async function down(db: Kysely<KyselyDatabase>): Promise<void> {
    await db.schema.dropTable('story').execute();
}
