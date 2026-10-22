import type { Kysely } from 'kysely';

import { getApplicationConfig } from '../../../src/Config/getApplicationConfig.js';
import { createKysely } from '../../../src/Persistence/Kysely/createKysely.js';
import type { KyselyDatabase } from '../../../src/Persistence/Kysely/KyselyDatabase.js';

/**
 * Creates a client for the prepared database specified in the application config.
 * The caller owns the returned connection and must destroy it when finished.
 */
export async function createTestDatabase(): Promise<Kysely<KyselyDatabase>> {
    const config = await getApplicationConfig();
    return createKysely(config);
}
