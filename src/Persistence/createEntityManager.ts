import type { ApplicationConfig } from '../Contracts/Config/ApplicationConfig.js';
import type { EntityManager } from '../Contracts/Persistence/EntityManager.js';
import { createKysely } from './Kysely/createKysely.js';
import { KyselyEntityManager } from './Kysely/KyselyEntityManager.js';

const registerRepositories = (_entityManager: KyselyEntityManager) => {
    // Register your repositories here using entityManager.registerRepository(token, factory)
    // Example:
    // entityManager.registerRepository(UserRepositoryToken, createUserRepository);
};

/**
 * Creates and initializes an EntityManager instance.
 * Create a new Kysely database connection each time and registers repositories.
 */
export const createEntityManager = async (config: ApplicationConfig): Promise<EntityManager> => {
    const db = createKysely(config);
    const entityManager = new KyselyEntityManager(db, config);
    registerRepositories(entityManager);

    return Promise.resolve(entityManager);
};
