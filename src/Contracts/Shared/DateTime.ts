declare const dateTimeBrand: unique symbol;

export type DateTime = string & {
    readonly [dateTimeBrand]: true;
};

export function createDateTime(value: unknown): DateTime {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new Error("Can't cast provided data to DateTime: use a valid Date");
        }

        return value.toISOString() as DateTime;
    }

    if (typeof value !== 'string') {
        throw new Error("Can't cast provided data to DateTime: use a Date or ISO 8601 UTC string");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
        throw new Error("Can't cast provided data to DateTime: use a valid ISO 8601 UTC string");
    }

    return value as DateTime;
}
