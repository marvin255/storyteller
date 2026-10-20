import { describe, expect, jest, test } from '@jest/globals';
import type { Kysely, Transaction } from 'kysely';

import type { ApplicationConfig } from '../../../../src/Contracts/Config/ApplicationConfig.js';
import type { EntityManager } from '../../../../src/Contracts/Persistence/EntityManager.js';
import { repositoryToken } from '../../../../src/Contracts/Persistence/RepositoryToken.js';
import type { KyselyDatabase } from '../../../../src/Persistence/Kysely/KyselyDatabase.js';
import { KyselyEntityManager } from '../../../../src/Persistence/Kysely/KyselyEntityManager.js';

interface TestRepository {
    readonly name: string;
}

const createEntityManager = () => {
    const destroy = jest.fn(() => Promise.resolve());
    const trx = {} as Transaction<KyselyDatabase>;
    const execute = jest.fn(<T>(action: (trx: Transaction<KyselyDatabase>) => Promise<T>) =>
        action(trx),
    );
    const transaction = jest.fn(() => ({ execute }));
    const db = {
        destroy,
        transaction,
    } as unknown as Kysely<KyselyDatabase>;
    const config: ApplicationConfig = {} as ApplicationConfig;

    return {
        db,
        destroy,
        trx,
        execute,
        transaction,
        config,
        entityManager: new KyselyEntityManager(db, config),
    };
};

describe('KyselyEntityManager', () => {
    describe('close', () => {
        test('destroys the database when closed', async () => {
            const { destroy, entityManager } = createEntityManager();

            await entityManager.close();

            expect(destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe('getRepository', () => {
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
    });

    describe('registerRepository', () => {
        test('requires a factory that creates the repository type identified by the token', () => {
            const { entityManager } = createEntityManager();
            const token = repositoryToken<TestRepository>('TestRepository');

            // @ts-expect-error The factory result does not satisfy TestRepository.
            entityManager.registerRepository(token, () => Promise.resolve({ id: 123 }));
        });

        test('throws when another factory is registered for the same token', () => {
            const { entityManager } = createEntityManager();
            const token = repositoryToken<TestRepository>('TestRepository');
            const originalFactory = jest.fn(() => Promise.resolve({ name: 'original' }));

            entityManager.registerRepository(token, originalFactory);

            expect(() => {
                entityManager.registerRepository(token, () =>
                    Promise.resolve({ name: 'replacement' }),
                );
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

    describe('runInTransaction', () => {
        test('waits for the action and returns its result', async () => {
            const { entityManager, transaction, execute } = createEntityManager();
            const deferred = Promise.withResolvers<string>();
            const action = jest.fn((_em: EntityManager) => deferred.promise);
            const settled = jest.fn();

            const result = entityManager.runInTransaction(action);
            const completion = result.then(settled);
            await Promise.resolve();

            expect(transaction).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledTimes(1);
            expect(action.mock.calls[0]?.[0]).not.toBe(entityManager);
            expect(settled).not.toHaveBeenCalled();

            deferred.resolve('completed');

            await expect(result).resolves.toBe('completed');
            await completion;
            expect(settled).toHaveBeenCalledWith('completed');
        });

        test('creates repositories using the transaction and application config', async () => {
            const { entityManager, trx, config } = createEntityManager();
            const token = repositoryToken<TestRepository>('TestRepository');
            const repository: TestRepository = { name: 'transaction repository' };
            const factory = jest.fn((_db: Kysely<KyselyDatabase>, _config: ApplicationConfig) =>
                Promise.resolve(repository),
            );
            entityManager.registerRepository(token, factory);

            await entityManager.runInTransaction(async (em) => {
                const firstRequest = em.getRepository(token);
                const secondRequest = em.getRepository(token);

                expect(secondRequest).toBe(firstRequest);
                await expect(firstRequest).resolves.toBe(repository);
            });

            expect(factory).toHaveBeenCalledTimes(1);
            expect(factory).toHaveBeenCalledWith(trx, config);
        });

        test('keeps parent and transaction repository caches separate', async () => {
            const { entityManager, db, trx, config } = createEntityManager();
            const token = repositoryToken<TestRepository>('TestRepository');
            const factory = jest.fn((_db: Kysely<KyselyDatabase>, _config: ApplicationConfig) =>
                Promise.resolve({ name: 'repository' }),
            );
            entityManager.registerRepository(token, factory);
            const parentRepository = await entityManager.getRepository(token);

            const firstRepository = await entityManager.runInTransaction((em) =>
                em.getRepository(token),
            );
            const secondRepository = await entityManager.runInTransaction((em) =>
                em.getRepository(token),
            );

            expect(firstRepository).not.toBe(parentRepository);
            expect(secondRepository).not.toBe(parentRepository);
            expect(secondRepository).not.toBe(firstRepository);
            await expect(entityManager.getRepository(token)).resolves.toBe(parentRepository);
            expect(factory).toHaveBeenCalledTimes(3);
            expect(factory).toHaveBeenNthCalledWith(1, db, config);
            expect(factory).toHaveBeenNthCalledWith(2, trx, config);
            expect(factory).toHaveBeenNthCalledWith(3, trx, config);
        });

        test('propagates asynchronous action failures', async () => {
            const { entityManager } = createEntityManager();
            const deferred = Promise.withResolvers<undefined>();
            const error = new Error('Action failed');

            const result = entityManager.runInTransaction(() => deferred.promise);
            const rejection = expect(result).rejects.toBe(error);
            deferred.reject(error);

            await rejection;
        });

        test('propagates synchronous action failures', async () => {
            const { entityManager } = createEntityManager();
            const error = new Error('Action failed');

            await expect(
                entityManager.runInTransaction(() => {
                    throw error;
                }),
            ).rejects.toBe(error);
        });

        test('propagates transaction execution failures', async () => {
            const { entityManager, execute } = createEntityManager();
            const error = new Error('Transaction failed');
            const action = jest.fn(() => Promise.resolve());
            execute.mockRejectedValueOnce(error);

            await expect(entityManager.runInTransaction(action)).rejects.toBe(error);
            expect(action).not.toHaveBeenCalled();
        });
    });
});
