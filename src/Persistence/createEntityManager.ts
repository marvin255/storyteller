import type { ApplicationConfig } from '../Contracts/Config/ApplicationConfig.js';
import { StoryRepository } from '../Contracts/Domain/Story/StoryRepository.js';
import type { EntityManager } from '../Contracts/Persistence/EntityManager.js';
import { createKysely } from './Kysely/createKysely.js';
import { KyselyEntityManager } from './Kysely/KyselyEntityManager.js';
import { KyselyStoryRepository } from './Kysely/Story/KyselyStoryRepository.js';

const registerRepositories = (entityManager: KyselyEntityManager) => {
    entityManager.registerRepository(StoryRepository, (db) =>
        Promise.resolve(new KyselyStoryRepository(db)),
    );
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
