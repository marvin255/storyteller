import { describe, expect, test } from '@jest/globals';

import { createDateTime, type DateTime } from '../../../src/Contracts/Shared/DateTime.js';

describe('createDateTime', () => {
    test.each([
        [
            'keeps a canonical ISO 8601 UTC string',
            '2026-06-08T19:42:00.000Z',
            '2026-06-08T19:42:00.000Z',
        ],
        [
            'casts a Date to a canonical ISO 8601 UTC string',
            new Date('2026-06-08T19:42:00.000Z'),
            '2026-06-08T19:42:00.000Z',
        ],
    ])('%s', (_message, value, expected) => {
        const dateTime: DateTime = createDateTime(value);

        expect(typeof dateTime).toBe('string');
        expect(dateTime).toBe(expected);
    });

    test.each([
        [
            'rejects null because DateTime must be a Date or string',
            null,
            "Can't cast provided data to DateTime: use a Date or ISO 8601 UTC string",
        ],
        [
            'rejects undefined because DateTime must be a Date or string',
            undefined,
            "Can't cast provided data to DateTime: use a Date or ISO 8601 UTC string",
        ],
        [
            'rejects number 123 because DateTime must be a Date or string',
            123,
            "Can't cast provided data to DateTime: use a Date or ISO 8601 UTC string",
        ],
        [
            'rejects an invalid Date',
            new Date('invalid'),
            "Can't cast provided data to DateTime: use a valid Date",
        ],
        [
            'rejects an empty string because it is not a valid date-time',
            '',
            "Can't cast provided data to DateTime: use a valid ISO 8601 UTC string",
        ],
        [
            'rejects a date-only string because it is not a full UTC date-time',
            '2026-06-08',
            "Can't cast provided data to DateTime: use a valid ISO 8601 UTC string",
        ],
        [
            'rejects a non-UTC ISO string because stored DateTime values must be canonical UTC',
            '2026-06-08T21:42:00.000+02:00',
            "Can't cast provided data to DateTime: use a valid ISO 8601 UTC string",
        ],
        [
            'rejects an ISO string without milliseconds because stored DateTime values must be canonical',
            '2026-06-08T19:42:00Z',
            "Can't cast provided data to DateTime: use a valid ISO 8601 UTC string",
        ],
    ])('%s', (_message, value, expectedMessage) => {
        expect(() => createDateTime(value)).toThrow(expectedMessage);
    });
});
