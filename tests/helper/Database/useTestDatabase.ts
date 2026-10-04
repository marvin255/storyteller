import { afterAll, afterEach, beforeAll, beforeEach } from '@jest/globals';
import type { ControlledTransaction, Kysely } from 'kysely';

import type { KyselyDatabase } from '../../../src/Persistence/Kysely/KyselyDatabase.js';
import { createTestDatabase } from './createTestDatabase.js';

/**
 * Registers database lifecycle hooks for a suite and exposes each test's transaction.
 */
export function useTestDatabase(): () => Kysely<KyselyDatabase> {
    let db: Kysely<KyselyDatabase> | undefined;
    let transaction: ControlledTransaction<KyselyDatabase> | undefined;

    beforeAll(async () => {
        db = await createTestDatabase();
    });

    beforeEach(async () => {
        if (db === undefined) {
            throw new Error('The test database has not been initialized.');
        }
        transaction = await db.startTransaction().execute();
    });

    afterEach(async () => {
        try {
            await transaction?.rollback().execute();
        } finally {
            transaction = undefined;
        }
    });

    afterAll(async () => {
        await db?.destroy();
    });

    return () => {
        if (transaction === undefined) {
            throw new Error('The test transaction is only available during a test.');
        }
        return transaction;
    };
}
