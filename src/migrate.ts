import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { FileMigrationProvider, Migrator, NO_MIGRATIONS } from 'kysely/migration';

import { getApplicationConfig } from './Config/getApplicationConfig.js';
import { createKysely } from './Persistence/Kysely/createKysely.js';

async function migrateToLatest(): Promise<void> {
    const config = await getApplicationConfig();
    const db = createKysely(config);

    try {
        const migrator = new Migrator({
            db,
            provider: new FileMigrationProvider({
                fs,
                path,
                migrationFolder: path.join(import.meta.dirname, 'Migrates'),
            }),
        });

        if (process.argv.includes('-refresh')) {
            const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);

            results?.forEach((result) => {
                if (result.status === 'Success') {
                    process.stdout.write(
                        `Migration "${result.migrationName}" was reverted successfully.\n`,
                    );
                } else if (result.status === 'Error') {
                    process.stderr.write(`Failed to revert migration "${result.migrationName}".\n`);
                }
            });

            if (error !== undefined) {
                throw error instanceof Error
                    ? error
                    : new Error('Migration rollback failed with an unknown error.', {
                          cause: error,
                      });
            }
        }

        const { error, results } = await migrator.migrateToLatest();

        results?.forEach((result) => {
            if (result.status === 'Success') {
                process.stdout.write(
                    `Migration "${result.migrationName}" was executed successfully.\n`,
                );
            } else if (result.status === 'Error') {
                process.stderr.write(`Failed to execute migration "${result.migrationName}".\n`);
            }
        });

        if (error !== undefined) {
            throw error instanceof Error
                ? error
                : new Error('Migration failed with an unknown error.', { cause: error });
        }
    } finally {
        await db.destroy();
    }
}

try {
    await migrateToLatest();
} catch (error: unknown) {
    process.stderr.write('Failed to migrate.\n');
    process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : 'Unknown error'}\n`,
    );
    process.exitCode = 1;
}
