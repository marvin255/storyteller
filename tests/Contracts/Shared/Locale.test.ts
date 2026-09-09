import { describe, expect, test } from '@jest/globals';

import { createLocale, type Locale } from '../../../src/Contracts/Shared/Locale.js';

describe('createLocale', () => {
    test.each([
        ['keeps language-only locale "en"', 'en', 'en'],
        ['keeps language and region locale "en-US"', 'en-US', 'en-US'],
        ['canonicalizes casing for "EN-us"', 'EN-us', 'en-US'],
        ['keeps script subtags for "zh-Hant-TW"', 'zh-Hant-TW', 'zh-Hant-TW'],
        [
            'removes Unicode extension subtags from "fr-FR-u-ca-gregory"',
            'fr-FR-u-ca-gregory',
            'fr-FR',
        ],
    ])('%s', (_message, value, expected) => {
        const locale: Locale = createLocale(value);

        expect(typeof locale).toBe('string');
        expect(locale).toBe(expected);
    });

    test.each([
        [
            'rejects null because Locale must be a string',
            null,
            "Can't cast provided data to Locale: use a BCP 47 locale string",
        ],
        [
            'rejects undefined because Locale must be a string',
            undefined,
            "Can't cast provided data to Locale: use a BCP 47 locale string",
        ],
        [
            'rejects number 123 because Locale must be a string',
            123,
            "Can't cast provided data to Locale: use a BCP 47 locale string",
        ],
        [
            'rejects an empty string because it is not a valid locale tag',
            '',
            "Can't cast provided data to Locale: use a valid BCP 47 locale string",
        ],
        [
            'rejects "en_US" because underscores are not valid BCP 47 separators',
            'en_US',
            "Can't cast provided data to Locale: use a valid BCP 47 locale string",
        ],
    ])('%s', (_message, value, expectedMessage) => {
        expect(() => createLocale(value)).toThrow(expectedMessage);
    });

    test('preserves the original Intl.Locale error as the cause', () => {
        expect.assertions(2);

        try {
            createLocale('');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).cause).toBeInstanceOf(RangeError);
        }
    });
});
