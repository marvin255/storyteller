import type { RepositoryToken } from './RepositoryToken.js';

/**
 * The EntityManager is responsible for managing repositories and providing access to them.
 * It allows retrieving repository instances based on their unique tokens.
 */
export interface EntityManager {
    /** Retrieves a repository instance associated with the given token. */
    getRepository<T>(token: RepositoryToken<T>): Promise<T>;

    /** Closes the EntityManager and releases any resources it holds, such as database connections. */
    close(): Promise<void>;
}
