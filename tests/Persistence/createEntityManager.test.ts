import { describe, expect, jest, test } from '@jest/globals';

import type { ApplicationConfig } from '../../src/Contracts/Config/ApplicationConfig.js';
import type { RepositoryToken } from '../../src/Contracts/Persistence/RepositoryToken.js';

const database = { name: 'database' };
const entityManager = {
    close: jest.fn(() => Promise.resolve()),
    getRepository: <T>(_token: RepositoryToken<T>): Promise<T> => {
        throw new Error('Not implemented by this test double.');
    },
    registerRepository: jest.fn(),
};
const createKysely = jest.fn((_config: ApplicationConfig) => database);
const KyselyEntityManager = jest.fn(
    (_database: typeof database, _config: ApplicationConfig) => entityManager,
);

// Native ESM modules must be mocked before dynamically importing the module under test.
jest.unstable_mockModule('../../src/Persistence/Kysely/createKysely.js', () => ({ createKysely }));
jest.unstable_mockModule('../../src/Persistence/Kysely/KyselyEntityManager.js', () => ({
    KyselyEntityManager,
}));

const { createEntityManager } = await import('../../src/Persistence/createEntityManager.js');

// The mocked dependencies only receive this config; they never read its fields.
const config = {} as ApplicationConfig;

describe('createEntityManager', () => {
    test('creates a Kysely entity manager with the configured database', async () => {
        await expect(createEntityManager(config)).resolves.toBe(entityManager);
        expect(createKysely).toHaveBeenCalledWith(config);
        expect(KyselyEntityManager).toHaveBeenCalledWith(database, config);
    });

    test('converts synchronous initialization failures to promise rejections', async () => {
        const error = new Error('Database initialization failed');
        createKysely.mockImplementationOnce(() => {
            throw error;
        });

        await expect(createEntityManager(config)).rejects.toBe(error);
    });
});
