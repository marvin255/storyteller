import { describe, expect, jest, test } from '@jest/globals';

import type { IOChannelSender } from '../../../src/Contracts/IOChannel/IOChannelSender.js';
import type { IOMessageInbound } from '../../../src/Contracts/IOChannel/IOMessageInbound.js';
import { createId } from '../../../src/Contracts/Shared/Id.js';
import { LLMEngine } from '../../../src/Engine/LLMEngine.js';

const createMessage = (messageId: string): IOMessageInbound => ({
    type: 'inbound',
    messageId: createId(messageId),
    externalId: createId(`external-${messageId}`),
    userId: createId(`user-${messageId}`),
    content: `Input ${messageId}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('LLMEngine', () => {
    test.each([false, true])('preserves externalId in replies (batch: %p)', async (batch) => {
        const send = jest.fn<IOChannelSender['send']>().mockResolvedValue(undefined);
        const engine = new LLMEngine({ send });
        const first = createMessage('one');
        const messages = batch ? [first, createMessage('two')] : [first];

        await engine.handle(batch ? messages : first);

        expect(send).toHaveBeenCalledTimes(messages.length);
        messages.forEach((message, index) => {
            expect(send).toHaveBeenNthCalledWith(index + 1, {
                type: 'outbound',
                messageId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
                externalId: message.externalId,
                userId: message.userId,
                content: `LLM response placeholder: ${message.content}`,
                createdAt: expect.any(Date),
            });
        });
    });

    test('sends no replies for an empty batch', async () => {
        const send = jest.fn<IOChannelSender['send']>().mockResolvedValue(undefined);

        await new LLMEngine({ send }).handle([]);

        expect(send).not.toHaveBeenCalled();
    });

    test('waits for each reply to be sent before sending the next and completing', async () => {
        const firstSend = Promise.withResolvers<undefined>();
        const secondSend = Promise.withResolvers<undefined>();
        const send = jest
            .fn<IOChannelSender['send']>()
            .mockReturnValueOnce(firstSend.promise)
            .mockReturnValueOnce(secondSend.promise);
        const engine = new LLMEngine({ send });
        const completed = jest.fn();

        const handling = engine
            .handle([createMessage('one'), createMessage('two')])
            .then(completed);

        expect(send).toHaveBeenCalledTimes(1);
        firstSend.resolve(undefined);
        await firstSend.promise;
        expect(send).toHaveBeenCalledTimes(2);
        expect(completed).not.toHaveBeenCalled();

        secondSend.resolve(undefined);
        await handling;
        expect(completed).toHaveBeenCalledTimes(1);
    });

    test.each([false, true])('propagates send failures (batch: %p)', async (batch) => {
        const error = new Error('Send failed');
        const send = jest.fn<IOChannelSender['send']>().mockRejectedValue(error);
        const engine = new LLMEngine({ send });
        const first = createMessage('one');

        await expect(engine.handle(batch ? [first, createMessage('two')] : first)).rejects.toThrow(
            error,
        );

        expect(send).toHaveBeenCalledTimes(1);
    });
});
