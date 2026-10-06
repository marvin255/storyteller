import type { Kysely, Selectable } from 'kysely';

import type { KyselyDatabase } from '../../../src/Persistence/Kysely/KyselyDatabase.js';

/**
 * Binds filtered row selections to the current test transaction.
 */
export function createSelectHelper(database: () => Kysely<KyselyDatabase>) {
    return async function selectFromDb<Table extends keyof KyselyDatabase>(
        table: Table,
        values: Partial<Selectable<KyselyDatabase[Table]>>,
    ): Promise<Selectable<KyselyDatabase[Table]>[]> {
        return database()
            .selectFrom<keyof KyselyDatabase>(table)
            .selectAll()
            .where((eb) => eb.and(values))
            .execute();
    };
}
