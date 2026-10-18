import type { LogContext } from '../../Contracts/Logger/LogContext.js';
import type { Logger } from '../../Contracts/Logger/Logger.js';
import { createRandomId } from '../../Contracts/Shared/Id.js';

/** Keeps a temporary pipeline logger while preserving the original logger. */
export class PipelineLoggerWrapper implements Logger {
    private pipelineRunLogger: Logger | undefined;

    constructor(private readonly logger: Logger) {}

    debug(message: string, context?: LogContext): void {
        this.currentLogger.debug(message, context);
    }

    info(message: string, context?: LogContext): void {
        this.currentLogger.info(message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.currentLogger.warn(message, context);
    }

    error(message: string, error?: unknown, context?: LogContext): void {
        this.currentLogger.error(message, error, context);
    }

    child(context: LogContext): Logger {
        return this.currentLogger.child(context);
    }

    /** Extends the temporary logger with additional context for the current run. */
    extendLoggerWithContext(context: LogContext): void {
        this.pipelineRunLogger = this.child(context);
    }

    /** Clears the temporary logger so the next run starts from the original logger. */
    resetLogger(): void {
        this.pipelineRunLogger = undefined;
    }

    /** Retrieves the current run logger, creating it lazily. */
    private get currentLogger(): Logger {
        this.pipelineRunLogger ??= this.logger.child({
            source: 'PipelineEngine',
            runId: createRandomId(),
        });
        return this.pipelineRunLogger;
    }
}
