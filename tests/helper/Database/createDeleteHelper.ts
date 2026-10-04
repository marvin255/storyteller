import type { Kysely, Selectable } from 'kysely';

import type { KyselyDatabase } from '../../../src/Persistence/Kysely/KyselyDatabase.js';

/**
 * Binds filtered fixture deletions to the current test transaction.
 */
export function createDeleteHelper(database: () => Kysely<KyselyDatabase>) {
    return async function deleteFromDb<Table extends keyof KyselyDatabase>(
        table: Table,
        values: Partial<Selectable<KyselyDatabase[Table]>>,
    ): Promise<bigint> {
        if (
            Object.keys(values).length === 0 ||
            Object.values<unknown>(values).some((value) => value === undefined)
        ) {
            throw new TypeError('Deletion requires a non-empty filter with defined column values.');
        }

        const result = await database()
            .deleteFrom<keyof KyselyDatabase>(table)
            .where((eb) => eb.and(values))
            .executeTakeFirstOrThrow();
        return result.numDeletedRows;
    };
}
