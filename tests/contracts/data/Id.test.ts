import { describe, expect, test } from '@jest/globals';

import { createId, type Id } from '../../../src/contracts/data/Id.js';

describe('createId', () => {
    test.each([
        ['casts ASCII letters to an Id', 'abcXYZ', 'abcXYZ'],
        ['casts integer 123 to Id string "123"', 123, '123'],
        ['keeps underscores because they are allowed', 'abc_123', 'abc_123'],
        ['keeps dashes because they are allowed', 'abc-123', 'abc-123'],
        ['casts an object using its toString result', { toString: () => 'object_id' }, 'object_id'],
        [
            'casts an object using its Symbol.toPrimitive result',
            { [Symbol.toPrimitive]: () => 'primitive_id' },
            'primitive_id',
        ],
        ['casts boolean true to Id string "true"', true, 'true'],
        ['casts bigint 123n to Id string "123"', 123n, '123'],
    ])('%s', (_message, value, expected) => {
        const id: Id = createId(value);

        expect(typeof id).toBe('string');
        expect(id).toBe(expected);
    });

    test.each([
        ['rejects an empty string because Id must be non-empty', ''],
        ['rejects "abc 123" because spaces are not allowed', 'abc 123'],
        ['rejects float 1.25 because dots are not allowed', 1.25],
        ['rejects "abcá" because accented letters are not allowed', 'abcá'],
        ['rejects a plain object because "[object Object]" contains brackets and spaces', {}],
    ])('%s', (_message, value) => {
        expect(() => createId(value)).toThrow(
            "Can't cast provided data to Id: use A-Z, a-z, 0-9, _, -"
        );
    });
});
