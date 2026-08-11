import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { ApplicationConfig } from '../../Contracts/Config/ApplicationConfig.js';
import type { KyselyDatabase } from './KyselyDatabase.js';

export function createKysely(config: ApplicationConfig) {
    if (config.database === undefined) {
        throw new Error('Database configuration is missing in the application config.');
    }

    const dialect = new PostgresDialect({
        pool: new Pool({
            database: config.database.database,
            host: config.database.host,
            user: config.database.user,
            port: config.database.port,
            password: config.database.password,
            max: 10,
        }),
    });

    return new Kysely<KyselyDatabase>({
        dialect,
    });
}
