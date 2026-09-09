declare const localeBrand: unique symbol;

export type Locale = string & {
    readonly [localeBrand]: true;
};

export function createLocale(value: unknown): Locale {
    if (typeof value !== 'string') {
        throw new Error("Can't cast provided data to Locale: use a BCP 47 locale string");
    }

    try {
        return new Intl.Locale(value).baseName as Locale;
    } catch (error) {
        throw new Error("Can't cast provided data to Locale: use a valid BCP 47 locale string", {
            cause: error,
        });
    }
}
