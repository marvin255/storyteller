import type { LogContext } from './LogContext.js';

/** Internal interface to wrap external logger implementations. */
export interface Logger {
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: unknown, context?: LogContext): void;
    child(context: LogContext): Logger;
}
