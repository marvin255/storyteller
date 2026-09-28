import type { LogContext } from '../Contracts/Logger/LogContext.js';
import type { Logger } from '../Contracts/Logger/Logger.js';

/** Composite logger that delegates logging to multiple loggers. */
export class CompositeLogger implements Logger {
    constructor(private readonly loggers: Logger[]) {}

    debug(message: string, context?: LogContext) {
        this.loggers.forEach((logger) => {
            logger.debug(message, context);
        });
    }

    info(message: string, context?: LogContext) {
        this.loggers.forEach((logger) => {
            logger.info(message, context);
        });
    }

    warn(message: string, context?: LogContext) {
        this.loggers.forEach((logger) => {
            logger.warn(message, context);
        });
    }

    error(message: string, error?: unknown, context?: LogContext) {
        this.loggers.forEach((logger) => {
            logger.error(message, error, context);
        });
    }

    child(context: LogContext): Logger {
        return new CompositeLogger(this.loggers.map((logger) => logger.child(context)));
    }
}
