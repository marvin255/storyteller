import type { LLMRequest } from './LLMRequest.js';
import type { LLMResponse } from './LLMResponse.js';

/**
 * Interface representing a client for interacting with a Language Model (LLM).
 */
export interface LLMClient {
    /**
     * Generates text based on the provided request.
     */
    generateText(request: LLMRequest): Promise<LLMResponse>;
}
