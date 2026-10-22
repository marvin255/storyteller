import type { Insertable, Kysely, Selectable } from 'kysely';

import type { KyselyDatabase } from '../../../src/Persistence/Kysely/KyselyDatabase.js';

/**
 * Binds fixture inserts to the current transaction exposed by useTestDatabase().
 */
export function createInsertHelper(database: () => Kysely<KyselyDatabase>) {
    return async function createInDb<Table extends keyof KyselyDatabase>(
        table: Table,
        values: Insertable<KyselyDatabase[Table]>,
    ): Promise<Selectable<KyselyDatabase[Table]>> {
        return database().insertInto(table).values(values).returningAll().executeTakeFirstOrThrow();
    };
}
