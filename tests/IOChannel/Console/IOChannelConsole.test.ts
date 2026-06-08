import readline from 'node:readline';
import { PassThrough, type Readable, type Writable } from 'node:stream';

import { afterEach, describe, expect, jest, test } from '@jest/globals';

import type { Engine } from '../../../src/Contracts/Engine/Engine.js';
import type { IOMessageInbound } from '../../../src/Contracts/IOChannel/IOMessageInbound.js';
import { createId } from '../../../src/Contracts/Shared/Id.js';
import { IOChannelConsole } from '../../../src/IOChannel/Console/IOChannelConsole.js';

type LineHandler = (line: string) => void;

interface ReadlineMock {
    close: jest.Mock;
    on: jest.Mock<(event: 'line', handler: LineHandler) => void>;
}

const createOutput = (): Writable & { write: jest.Mock } =>
    ({
        write: jest.fn(),
    }) as unknown as Writable & { write: jest.Mock };

const createEngine = (): Engine & { handle: jest.MockedFunction<Engine['handle']> } => ({
    handle: jest.fn(),
});

const createReadlineMock = (): ReadlineMock => ({
    close: jest.fn(),
    on: jest.fn(),
});

describe('IOChannelConsole', () => {
    const channelId = createId('channel');
    const userId = createId('initial-user');
    const sessionId = createId('initial-session');

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('creates a readline interface and writes the initial inbound prompt when attached', () => {
        const input: Readable = new PassThrough();
        const output = createOutput();
        const engine = createEngine();
        const readlineInstance = createReadlineMock();
        const createInterface = jest
            .spyOn(readline, 'createInterface')
            .mockReturnValue(readlineInstance as unknown as readline.Interface);

        const consoleChannel = new IOChannelConsole(input, output, channelId, userId, sessionId);

        consoleChannel.attachEngine(engine);

        expect(createInterface).toHaveBeenCalledWith({ input, output });
        expect(output.write).toHaveBeenCalledWith('initial-user (initial-session) > ');
        expect(readlineInstance.on).toHaveBeenCalledWith('line', expect.any(Function));
    });

    test('uses default streams and ids when constructor arguments are omitted', () => {
        const engine = createEngine();
        const readlineInstance = createReadlineMock();
        const createInterface = jest
            .spyOn(readline, 'createInterface')
            .mockReturnValue(readlineInstance as unknown as readline.Interface);
        const stdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

        const consoleChannel = new IOChannelConsole();

        consoleChannel.attachEngine(engine);
        consoleChannel.send({
            id: createId('message'),
            sessionId: createId('reply-session'),
            userId,
            content: 'Default channel response.',
        });

        expect(createInterface).toHaveBeenCalledWith({
            input: process.stdin,
            output: process.stdout,
        });
        expect(stdoutWrite).toHaveBeenNthCalledWith(1, 'console-user (story) > ');
        expect(stdoutWrite).toHaveBeenNthCalledWith(
            2,
            'storyteller (reply-session) > Default channel response.\n',
        );
    });

    test('trims regular input lines and forwards them to the engine', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('  create a quiet forest scene  ');

        expect(engine.handle).toHaveBeenCalledTimes(1);
        const message = getHandledMessage(engine);
        expect(message.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
        );
        expect(message).toEqual({
            id: message.id,
            sessionId,
            userId,
            content: 'create a quiet forest scene',
        });
    });

    test('treats invalid slash commands as regular input', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('/user-id user with spaces');

        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId,
                userId,
                content: '/user-id user with spaces',
            }),
        );
    });

    test('treats embedded user id commands as regular input', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('say /user-id next-user');

        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId,
                userId,
                content: 'say /user-id next-user',
            }),
        );
    });

    test('treats embedded session id commands as regular input', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('say /session-id next-session');

        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId,
                userId,
                content: 'say /session-id next-session',
            }),
        );
    });

    test('treats session id commands with trailing content as regular input', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('/session-id next-session extra');

        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId,
                userId,
                content: '/session-id next-session extra',
            }),
        );
    });

    test('updates the user id command without forwarding the command to the engine', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('/user-id next_user-123');
        lineHandler('hello');

        expect(engine.handle).toHaveBeenCalledTimes(1);
        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId,
                userId: createId('next_user-123'),
                content: 'hello',
            }),
        );
    });

    test('updates the user id command when separated by repeated whitespace', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('/user-id   next_user-123');
        lineHandler('hello');

        expect(engine.handle).toHaveBeenCalledTimes(1);
        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId,
                userId: createId('next_user-123'),
                content: 'hello',
            }),
        );
    });

    test('updates the session id command without forwarding the command to the engine', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('/session-id next_session-123');
        lineHandler('hello');

        expect(engine.handle).toHaveBeenCalledTimes(1);
        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: createId('next_session-123'),
                userId,
                content: 'hello',
            }),
        );
    });

    test('updates the session id command when separated by repeated whitespace', () => {
        const { engine, lineHandler } = attachConsole();

        lineHandler('/session-id   next_session-123');
        lineHandler('hello');

        expect(engine.handle).toHaveBeenCalledTimes(1);
        expect(engine.handle).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: createId('next_session-123'),
                userId,
                content: 'hello',
            }),
        );
    });

    test('closes readline on the exit command without forwarding the command to the engine', () => {
        const { engine, lineHandler, readlineInstance } = attachConsole();

        lineHandler('/exit');

        expect(readlineInstance.close).toHaveBeenCalledTimes(1);
        expect(engine.handle).not.toHaveBeenCalled();
    });

    test('sends one outbound message to the output stream', () => {
        const output = createOutput();
        const consoleChannel = new IOChannelConsole(
            new PassThrough(),
            output,
            channelId,
            userId,
            sessionId,
        );

        consoleChannel.send({
            id: createId('message'),
            sessionId: createId('reply-session'),
            userId,
            content: 'A lantern flickers.',
        });

        expect(output.write).toHaveBeenCalledWith(
            'channel (reply-session) > A lantern flickers.\n',
        );
    });

    test('sends each outbound message when given an array', () => {
        const output = createOutput();
        const consoleChannel = new IOChannelConsole(
            new PassThrough(),
            output,
            channelId,
            userId,
            sessionId,
        );

        consoleChannel.send([
            {
                id: createId('first'),
                sessionId: createId('reply-session'),
                userId,
                content: 'First line.',
            },
            {
                id: createId('second'),
                sessionId: createId('reply-session'),
                userId,
                content: 'Second line.',
            },
        ]);

        expect(output.write).toHaveBeenNthCalledWith(1, 'channel (reply-session) > First line.\n');
        expect(output.write).toHaveBeenNthCalledWith(2, 'channel (reply-session) > Second line.\n');
    });

    function attachConsole(): {
        engine: Engine & { handle: jest.MockedFunction<Engine['handle']> };
        lineHandler: LineHandler;
        readlineInstance: ReadlineMock;
    } {
        const engine = createEngine();
        const readlineInstance = createReadlineMock();
        jest.spyOn(readline, 'createInterface').mockReturnValue(
            readlineInstance as unknown as readline.Interface,
        );

        const consoleChannel = new IOChannelConsole(
            new PassThrough(),
            createOutput(),
            channelId,
            userId,
            sessionId,
        );

        consoleChannel.attachEngine(engine);

        const [, lineHandler] = readlineInstance.on.mock.calls[0] ?? [];
        if (lineHandler === undefined) {
            throw new Error('Expected IOChannelConsole to register a line handler');
        }

        return { engine, lineHandler, readlineInstance };
    }

    function getHandledMessage(
        engine: Engine & { handle: jest.MockedFunction<Engine['handle']> },
    ): IOMessageInbound {
        const [message] = engine.handle.mock.calls[0] ?? [];
        if (message === undefined || Array.isArray(message)) {
            throw new Error('Expected engine to handle one inbound message');
        }

        return message;
    }
});
