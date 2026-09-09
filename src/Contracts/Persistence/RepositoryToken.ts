/**
 * This token is used to identify a repository in the EntityManager.
 * It is a unique symbol that can be used to retrieve the corresponding repository instance.
 */
export type RepositoryToken<T> = symbol & {
    readonly __type?: T;
};

/**
 * Creates a new repository token for the given type.
 */
export function repositoryToken<T>(name: string): RepositoryToken<T> {
    return Symbol(name);
}
