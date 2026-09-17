import { generateText, type LanguageModel, type ModelMessage } from 'ai';

import type { LLMClient } from '../Contracts/LLM/LLMClient.js';
import type { LLMRequest } from '../Contracts/LLM/LLMRequest.js';
import type { LLMResponse } from '../Contracts/LLM/LLMResponse.js';

/**
 * AISDKLLMClient is a client for interacting with the AI SDK's language model.
 */
export class AISDKLLMClient implements LLMClient {
    constructor(private readonly model: LanguageModel) {}

    /**
     * Generates text based on the provided LLMRequest.
     */
    async generateText(request: LLMRequest): Promise<LLMResponse> {
        const LLMMessages: ModelMessage[] = request.messages.map((message) => ({
            role: message.role,
            content: message.text,
        }));

        let generateParams;
        if (request.instructions) {
            generateParams = {
                model: this.model,
                instructions: request.instructions,
                messages: LLMMessages,
            };
        } else {
            generateParams = {
                model: this.model,
                messages: LLMMessages,
            };
        }

        const response = await generateText(generateParams);

        return {
            message: {
                role: 'assistant',
                text: response.text,
            },
        };
    }
}
