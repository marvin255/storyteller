import { describe, expect, jest, test } from '@jest/globals';

import type { IOChannelSender } from '../../../src/Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../../../src/Contracts/IOChannel/IOMessageInbound.js';
import { createId } from '../../../src/Contracts/Shared/Id.js';
import { LLMEngine } from '../../../src/Engine/LLMEngine.js';

const createMessage = (id: string): IOMessageInbound => ({
    id: createId(id),
    externalId: createId(`external-${id}`),
    userId: createId(`user-${id}`),
    content: `Input ${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('LLMEngine', () => {
    test.each([false, true])('preserves externalId in replies (batch: %p)', async (batch) => {
        const send = jest.fn<IOChannelSender['send']>();
        const engine = new LLMEngine({ send });
        const first = createMessage('one');
        const messages = batch ? [first, createMessage('two')] : [first];

        await engine.handle(batch ? messages : first);

        expect(send).toHaveBeenCalledTimes(messages.length);
        messages.forEach((message, index) => {
            expect(send).toHaveBeenNthCalledWith(index + 1, {
                id: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                externalId: message.externalId,
                userId: message.userId,
                content: `LLM response placeholder: ${message.content}`,
            });
        });
    });

    test('sends no replies for an empty batch', async () => {
        const send = jest.fn<IOChannelSender['send']>();

        await new LLMEngine({ send }).handle([]);

        expect(send).not.toHaveBeenCalled();
    });
});
