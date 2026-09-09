import type { Kysely } from 'kysely';

import type { ApplicationConfig } from '../../Contracts/Config/ApplicationConfig.js';
import type { EntityManager } from '../../Contracts/Persistence/EntityManager.js';
import type { RepositoryToken } from '../../Contracts/Persistence/RepositoryToken.js';
import type { KyselyDatabase } from './KyselyDatabase.js';

type RepositoryFactory<T> = (db: Kysely<KyselyDatabase>, config: ApplicationConfig) => Promise<T>;

/**
 * The KyselyEntityManager is responsible for managing repositories and providing access to them.
 * It allows retrieving repository instances based on their unique tokens.
 */
export class KyselyEntityManager implements EntityManager {
    private factories = new Map<RepositoryToken<unknown>, RepositoryFactory<unknown>>();

    private repositories = new Map<RepositoryToken<unknown>, Promise<unknown>>();

    constructor(
        private db: Kysely<KyselyDatabase>,
        private config: ApplicationConfig,
    ) {}

    /**
     * Retrieves a repository instance associated with the given token.
     * Creates the repository if it does not already exist, using the registered factory.
     * Repositories are cached for future retrievals.
     */
    getRepository<T>(token: RepositoryToken<T>): Promise<T> {
        let repository = this.repositories.get(token);

        if (!repository) {
            const factory = this.factories.get(token);
            if (!factory) {
                throw new Error(`Repository for token ${token.toString()} not found`);
            }
            repository = factory(this.db, this.config);
            this.repositories.set(token, repository);
        }

        return repository as Promise<T>;
    }

    /**
     * Closes the EntityManager and releases any resources it holds, such as database connections.
     */
    async close(): Promise<void> {
        await this.db.destroy();
    }

    /**
     * Registers a repository factory for the given token.
     * Throws an error if a factory is already registered for the token.
     */
    registerRepository<T>(token: RepositoryToken<T>, factory: RepositoryFactory<NoInfer<T>>): void {
        if (this.factories.has(token)) {
            throw new Error(`Repository for token ${token.toString()} is already registered`);
        }
        this.factories.set(token, factory);
    }
}
