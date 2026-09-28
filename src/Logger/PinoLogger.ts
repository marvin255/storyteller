import pino, { type Logger as Pino } from 'pino';

import type { LogContext } from '../Contracts/Logger/LogContext.js';
import type { Logger } from '../Contracts/Logger/Logger.js';

/** Implementation of the Logger interface using the Pino logging library. */
export class PinoLogger implements Logger {
    constructor(private readonly logger: Pino = pino()) {}

    debug(message: string, context?: LogContext): void {
        this.logger.debug(context, message);
    }

    info(message: string, context?: LogContext): void {
        this.logger.info(context, message);
    }

    warn(message: string, context?: LogContext): void {
        this.logger.warn(context, message);
    }

    error(message: string, error?: unknown, context?: LogContext): void {
        this.logger.error({ ...context, err: error }, message);
    }

    child(context: LogContext): Logger {
        return new PinoLogger(this.logger.child(context));
    }
}
