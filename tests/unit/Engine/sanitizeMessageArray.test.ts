import { describe, expect, jest, test } from '@jest/globals';

import type { IOMessageInbound } from '../../../src/Contracts/IOChannel/IOMessageInbound.js';
import type { Logger } from '../../../src/Contracts/Logger/Logger.js';
import { createId } from '../../../src/Contracts/Shared/Id.js';
import { sanitizeMessageArray } from '../../../src/Engine/sanitizeMessageArray.js';

const createMessage = (
    messageId: string,
    createdAt: string,
    externalId = 'session-one',
): IOMessageInbound => ({
    messageId: createId(messageId),
    externalId: createId(externalId),
    userId: createId('user-one'),
    content: `Message ${messageId}`,
    createdAt: new Date(createdAt),
});

const createLogger = () => {
    const warn = jest.fn<Logger['warn']>();
    return { logger: { warn } as unknown as Logger, warn };
};

describe('sanitizeMessageArray', () => {
    test('wraps a single message in an array', () => {
        const message = createMessage('one', '2026-01-01T00:00:00.000Z');

        expect(sanitizeMessageArray(message)).toEqual([message]);
    });

    test('sorts messages by creation time without changing the input array', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const second = createMessage('second', '2026-01-02T00:00:00.000Z');
        const third = createMessage('third', '2026-01-03T00:00:00.000Z');
        const input = [third, first, second];

        expect(sanitizeMessageArray(input)).toEqual([first, second, third]);
        expect(input).toEqual([third, first, second]);
    });

    test('keeps the first message for each messageId and warns about duplicates', () => {
        const original = createMessage('same', '2026-01-03T00:00:00.000Z');
        const duplicate = createMessage('same', '2026-01-01T00:00:00.000Z');
        const other = createMessage('other', '2026-01-02T00:00:00.000Z');
        const { logger, warn } = createLogger();

        expect(sanitizeMessageArray([original, duplicate, other], logger)).toEqual([
            other,
            original,
        ]);
        expect(warn.mock.calls).toEqual([
            ['Duplicate message detected', { messageId: original.messageId }],
        ]);
    });

    test('filters null and undefined entries from runtime input', () => {
        const message = createMessage('one', '2026-01-01T00:00:00.000Z');
        const { logger, warn } = createLogger();
        const input = [null, message, undefined] as unknown as IOMessageInbound[];

        expect(sanitizeMessageArray(input, logger)).toEqual([message]);
        expect(warn).not.toHaveBeenCalled();
    });

    test('returns an empty array without warning when no messages remain after filtering', () => {
        const { logger, warn } = createLogger();
        const input = [null, undefined] as unknown as IOMessageInbound[];

        expect(sanitizeMessageArray(input, logger)).toEqual([]);
        expect(warn).not.toHaveBeenCalled();
    });

    test('handles an empty array without a logger', () => {
        expect(sanitizeMessageArray([])).toEqual([]);
    });

    test('uses the first non-null message externalId before sorting and warns for each mismatch', () => {
        const first = createMessage('first', '2026-01-03T00:00:00.000Z');
        const other = createMessage('other', '2026-01-01T00:00:00.000Z', 'session-two');
        const matching = createMessage('matching', '2026-01-02T00:00:00.000Z');
        const another = createMessage('another', '2026-01-04T00:00:00.000Z', 'session-three');
        const input = [null, first, other, matching, another] as unknown as IOMessageInbound[];
        const { logger, warn } = createLogger();

        expect(sanitizeMessageArray(input, logger)).toEqual([matching, first]);
        expect(input).toEqual([null, first, other, matching, another]);
        expect(warn.mock.calls).toEqual([
            [
                'Message has a different externalId',
                {
                    message: expect.objectContaining({ messageId: other.messageId }),
                    expectedExternalId: first.externalId,
                },
            ],
            [
                'Message has a different externalId',
                {
                    message: expect.objectContaining({ messageId: another.messageId }),
                    expectedExternalId: first.externalId,
                },
            ],
        ]);
    });

    test('filters messages from other external IDs without a logger', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const other = createMessage('other', '2026-01-02T00:00:00.000Z', 'session-two');

        expect(sanitizeMessageArray([first, other])).toEqual([first]);
    });

    test.each([undefined, null, ''])(
        'returns no messages when the first externalId is %p',
        (externalId) => {
            const invalid = {
                ...createMessage('invalid', '2026-01-01T00:00:00.000Z'),
                externalId,
            } as unknown as IOMessageInbound;
            const valid = createMessage('valid', '2026-01-02T00:00:00.000Z');
            const { logger, warn } = createLogger();

            expect(sanitizeMessageArray([invalid, valid], logger)).toEqual([]);
            expect(warn).not.toHaveBeenCalled();
        },
    );

    test('removes duplicates before filtering external IDs', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const other = createMessage('same', '2026-01-02T00:00:00.000Z', 'session-two');
        const duplicate = createMessage('same', '2026-01-03T00:00:00.000Z');
        const { logger, warn } = createLogger();

        expect(sanitizeMessageArray([first, other, duplicate], logger)).toEqual([first]);
        expect(warn.mock.calls).toEqual([
            ['Duplicate message detected', { messageId: duplicate.messageId }],
            [
                'Message has a different externalId',
                {
                    message: expect.objectContaining({ messageId: other.messageId }),
                    expectedExternalId: first.externalId,
                },
            ],
        ]);
    });

    test('preserves input order for messages with equal timestamps', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const second = createMessage('second', '2026-01-01T00:00:00.000Z');

        expect(sanitizeMessageArray([second, first])).toEqual([second, first]);
    });
});
