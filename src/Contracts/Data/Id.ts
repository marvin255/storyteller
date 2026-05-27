declare const idBrand: unique symbol;

export type Id = string & {
    readonly [idBrand]: true;
};

const ID_PATTERN = /^[A-Za-z0-9_-]+$/u;

export function createId(value: unknown): Id {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
        throw new Error("Can't cast provided data to Id: use a string, number, or bigint");
    }

    const id = String(value);

    if (!ID_PATTERN.test(id)) {
        throw new Error("Can't cast provided data to Id: use A-Z, a-z, 0-9, _, -");
    }

    return id as Id;
}
