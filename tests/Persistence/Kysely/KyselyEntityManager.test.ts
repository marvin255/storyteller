import { describe, expect, jest, test } from '@jest/globals';
import type { Kysely } from 'kysely';

import type { ApplicationConfig } from '../../../src/Contracts/Config/ApplicationConfig.js';
import { repositoryToken } from '../../../src/Contracts/Persistence/RepositoryToken.js';
import type { KyselyDatabase } from '../../../src/Persistence/Kysely/KyselyDatabase.js';
import { KyselyEntityManager } from '../../../src/Persistence/Kysely/KyselyEntityManager.js';

interface TestRepository {
    readonly name: string;
}

const createEntityManager = () => {
    const db = {} as Kysely<KyselyDatabase>;
    const config: ApplicationConfig = {} as ApplicationConfig;

    return {
        db,
        config,
        entityManager: new KyselyEntityManager(db, config),
    };
};

describe('KyselyEntityManager', () => {
    test('throws when no factory is registered for a token', () => {
        const { entityManager } = createEntityManager();
        const token = repositoryToken<TestRepository>('TestRepository');

        expect(() => entityManager.getRepository(token)).toThrow(
            'Repository for token Symbol(TestRepository) not found',
        );
    });

    test('creates a repository with the database and application config', async () => {
        const { db, config, entityManager } = createEntityManager();
        const token = repositoryToken<TestRepository>('TestRepository');
        const repository: TestRepository = { name: 'test repository' };
        const factory = jest.fn((_db: Kysely<KyselyDatabase>, _config: ApplicationConfig) =>
            Promise.resolve(repository),
        );

        entityManager.registerRepository(token, factory);

        await expect(entityManager.getRepository(token)).resolves.toBe(repository);
        expect(factory).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledWith(db, config);
    });

    test('requires a factory that creates the repository type identified by the token', () => {
        const { entityManager } = createEntityManager();
        const token = repositoryToken<TestRepository>('TestRepository');

        // @ts-expect-error The factory result does not satisfy TestRepository.
        entityManager.registerRepository(token, () => Promise.resolve({ id: 123 }));
    });

    test('returns the cached repository promise on subsequent requests', async () => {
        const { entityManager } = createEntityManager();
        const token = repositoryToken<TestRepository>('TestRepository');
        const repository: TestRepository = { name: 'test repository' };
        const factory = jest.fn(() => Promise.resolve(repository));

        entityManager.registerRepository(token, factory);

        const firstRequest = entityManager.getRepository(token);
        const secondRequest = entityManager.getRepository(token);

        expect(secondRequest).toBe(firstRequest);
        await expect(secondRequest).resolves.toBe(repository);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    test('caches a rejected repository promise', async () => {
        const { entityManager } = createEntityManager();
        const token = repositoryToken<TestRepository>('TestRepository');
        const error = new Error('Repository creation failed');
        const factory = jest.fn(() => Promise.reject(error));

        entityManager.registerRepository(token, factory);

        const firstRequest = entityManager.getRepository(token);
        const secondRequest = entityManager.getRepository(token);

        expect(secondRequest).toBe(firstRequest);
        await expect(firstRequest).rejects.toBe(error);
        expect(factory).toHaveBeenCalledTimes(1);
    });

    test('throws when another factory is registered for the same token', () => {
        const { entityManager } = createEntityManager();
        const token = repositoryToken<TestRepository>('TestRepository');
        const originalFactory = jest.fn(() => Promise.resolve({ name: 'original' }));

        entityManager.registerRepository(token, originalFactory);

        expect(() => {
            entityManager.registerRepository(token, () => Promise.resolve({ name: 'replacement' }));
        }).toThrow('Repository for token Symbol(TestRepository) is already registered');
    });

    test('treats tokens with the same description as distinct registrations', async () => {
        const { entityManager } = createEntityManager();
        const firstToken = repositoryToken<TestRepository>('TestRepository');
        const secondToken = repositoryToken<TestRepository>('TestRepository');
        const firstRepository: TestRepository = { name: 'first' };
        const secondRepository: TestRepository = { name: 'second' };

        entityManager.registerRepository(firstToken, () => Promise.resolve(firstRepository));
        entityManager.registerRepository(secondToken, () => Promise.resolve(secondRepository));

        await expect(entityManager.getRepository(firstToken)).resolves.toBe(firstRepository);
        await expect(entityManager.getRepository(secondToken)).resolves.toBe(secondRepository);
    });
});
