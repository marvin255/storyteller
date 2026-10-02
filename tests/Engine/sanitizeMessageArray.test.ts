import { describe, expect, jest, test } from '@jest/globals';

import type { IOMessageInbound } from '../../src/Contracts/IOChannel/IOMessageInbound.js';
import type { Logger } from '../../src/Contracts/Logger/Logger.js';
import { createId } from '../../src/Contracts/Shared/Id.js';
import { sanitizeMessageArray } from '../../src/Engine/sanitizeMessageArray.js';

const createMessage = (
    id: string,
    createdAt: string,
    sessionId = 'session-one',
): IOMessageInbound => ({
    id: createId(id),
    sessionId: createId(sessionId),
    userId: createId('user-one'),
    content: `Message ${id}`,
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

    test('keeps the first message for each id and warns about duplicates', () => {
        const original = createMessage('same', '2026-01-03T00:00:00.000Z');
        const duplicate = createMessage('same', '2026-01-01T00:00:00.000Z');
        const other = createMessage('other', '2026-01-02T00:00:00.000Z');
        const { logger, warn } = createLogger();

        expect(sanitizeMessageArray([original, duplicate, other], logger)).toEqual([
            other,
            original,
        ]);
        expect(warn.mock.calls).toEqual([['Duplicate message detected with id: same']]);
    });

    test('filters null and undefined entries from runtime input', () => {
        const message = createMessage('one', '2026-01-01T00:00:00.000Z');
        const { logger, warn } = createLogger();
        const input = [null, message, undefined] as unknown as IOMessageInbound[];

        expect(sanitizeMessageArray(input, logger)).toEqual([message]);
        expect(warn).not.toHaveBeenCalled();
    });

    test('warns when no messages remain after filtering', () => {
        const { logger, warn } = createLogger();
        const input = [null, undefined] as unknown as IOMessageInbound[];

        expect(sanitizeMessageArray(input, logger)).toEqual([]);
        expect(warn.mock.calls).toEqual([['Received an empty message array']]);
    });

    test('handles an empty array without a logger', () => {
        expect(sanitizeMessageArray([])).toEqual([]);
    });

    test('uses the first non-null message session before sorting and warns for each mismatch', () => {
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
                'Message with id: other has a different sessionId: session-two than expected: session-one',
            ],
            [
                'Message with id: another has a different sessionId: session-three than expected: session-one',
            ],
        ]);
    });

    test('filters messages from other sessions without a logger', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const other = createMessage('other', '2026-01-02T00:00:00.000Z', 'session-two');

        expect(sanitizeMessageArray([first, other])).toEqual([first]);
    });

    test.each([undefined, null, ''])(
        'returns no messages when the first sessionId is %p',
        (sessionId) => {
            const invalid = {
                ...createMessage('invalid', '2026-01-01T00:00:00.000Z'),
                sessionId,
            } as unknown as IOMessageInbound;
            const valid = createMessage('valid', '2026-01-02T00:00:00.000Z');
            const { logger, warn } = createLogger();

            expect(sanitizeMessageArray([invalid, valid], logger)).toEqual([]);
            expect(warn).not.toHaveBeenCalled();
        },
    );

    test('removes duplicates before filtering sessions', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const other = createMessage('same', '2026-01-02T00:00:00.000Z', 'session-two');
        const duplicate = createMessage('same', '2026-01-03T00:00:00.000Z');
        const { logger, warn } = createLogger();

        expect(sanitizeMessageArray([first, other, duplicate], logger)).toEqual([first]);
        expect(warn.mock.calls).toEqual([
            ['Duplicate message detected with id: same'],
            [
                'Message with id: same has a different sessionId: session-two than expected: session-one',
            ],
        ]);
    });

    test('preserves input order for messages with equal timestamps', () => {
        const first = createMessage('first', '2026-01-01T00:00:00.000Z');
        const second = createMessage('second', '2026-01-01T00:00:00.000Z');

        expect(sanitizeMessageArray([second, first])).toEqual([second, first]);
    });
});
