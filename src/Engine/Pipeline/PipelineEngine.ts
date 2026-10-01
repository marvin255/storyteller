import type { Engine } from '../../Contracts/Engine/Engine.js';
import type { IOMessageInbound } from '../../Contracts/IOChannel/IOMessageInbound.js';

/**
 * Narrative engine that processes messages through a pipeline of operations.
 */
export class PipelineEngine implements Engine {
    /**
     * Handles incoming messages by processing them through the pipeline.
     */
    handle(_message: IOMessageInbound | IOMessageInbound[]): Promise<void> {
        return Promise.resolve();
    }
}
