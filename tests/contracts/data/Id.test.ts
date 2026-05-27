import { describe, expect, test } from '@jest/globals';

import { createId, type Id } from '../../../src/contracts/data/Id.js';

describe('createId', () => {
    test.each([
        ['casts ASCII letters to an Id', 'abcXYZ', 'abcXYZ'],
        ['casts integer 123 to Id string "123"', 123, '123'],
        ['keeps underscores because they are allowed', 'abc_123', 'abc_123'],
        ['keeps dashes because they are allowed', 'abc-123', 'abc-123'],
        ['casts bigint 123n to Id string "123"', 123n, '123'],
    ])('%s', (_message, value, expected) => {
        const id: Id = createId(value);

        expect(typeof id).toBe('string');
        expect(id).toBe(expected);
    });

    test.each([
        [
            'rejects null because Id must be stringifiable from a primitive',
            null,
            "Can't cast provided data to Id: use a string, number, or bigint",
        ],
        [
            'rejects undefined because Id must be stringifiable from a primitive',
            undefined,
            "Can't cast provided data to Id: use a string, number, or bigint",
        ],
        [
            'rejects boolean true because booleans are not valid identifiers',
            true,
            "Can't cast provided data to Id: use a string, number, or bigint",
        ],
        ['rejects an empty string because Id must be non-empty', ''],
        ['rejects "abc 123" because spaces are not allowed', 'abc 123'],
        ['rejects float 1.25 because dots are not allowed', 1.25],
        ['rejects "abcá" because accented letters are not allowed', 'abcá'],
        [
            'rejects a plain object because objects are not valid identifiers',
            {},
            "Can't cast provided data to Id: use a string, number, or bigint",
        ],
    ])(
        '%s',
        (
            _message,
            value,
            expectedMessage = "Can't cast provided data to Id: use A-Z, a-z, 0-9, _, -",
        ) => {
            expect(() => createId(value)).toThrow(expectedMessage);
        },
    );
});
