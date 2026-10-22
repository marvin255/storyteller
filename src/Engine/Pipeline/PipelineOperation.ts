import type { PipelineOperationContext } from './PipelineOperationContext.js';
import type { PipelineOperationResult } from './PipelineOperationResult.js';

/**
 * Represents a single operation in the pipeline that processes incoming messages and generates narrative responses.
 */
export interface PipelineOperation {
    /**
     * Executes the operation with the provided context and returns the result.
     * Result contains only changes that should be added to the DB or sent to the user.
     */
    run(context: PipelineOperationContext): Promise<PipelineOperationResult>;
}
