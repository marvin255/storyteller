import type { LogContext } from '../../../src/Contracts/Logger/LogContext.js';
import type { Logger } from '../../../src/Contracts/Logger/Logger.js';

export interface TestLogEntry {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly message: string;
    readonly context: LogContext;
    readonly error?: unknown;
}

export interface TestLogger extends Logger {
    child(context: LogContext): TestLogger;
    getEntries(): readonly TestLogEntry[];
}

/** Creates an in-memory logger whose children share the same instance and accumulated context. */
export function createTestLogger(): TestLogger {
    const entries: TestLogEntry[] = [];
    let childContext: LogContext = {};
    const logger: TestLogger = {
        debug(message, context) {
            entries.push({ level: 'debug', message, context: { ...childContext, ...context } });
        },
        info(message, context) {
            entries.push({ level: 'info', message, context: { ...childContext, ...context } });
        },
        warn(message, context) {
            entries.push({ level: 'warn', message, context: { ...childContext, ...context } });
        },
        error(message, error, context) {
            entries.push({
                level: 'error',
                message,
                error,
                context: { ...childContext, ...context },
            });
        },
        child(context) {
            childContext = { ...childContext, ...context };
            return logger;
        },
        getEntries() {
            return [...entries];
        },
    };
    return logger;
}
