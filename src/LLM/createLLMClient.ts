import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import type { ApplicationConfig } from '../Contracts/Config/ApplicationConfig.js';
import type { LLMClient } from '../Contracts/LLM/LLMClient.js';
import { AISDKLLMClient } from './AISDKLLMClient.js';

/**
 * Creates a LanguageModel instance based on the specified provider, model, and optional API key.
 */
const createModel = (provider: string, model: string, apiKey?: string): LanguageModel => {
    let providerSettings;
    if (apiKey) {
        providerSettings = { apiKey };
    } else {
        providerSettings = {};
    }

    switch (provider) {
        case 'openai':
            return createOpenAI(providerSettings)(model);
        case 'anthropic':
            return createAnthropic(providerSettings)(model);
        case 'google':
            return createGoogleGenerativeAI(providerSettings)(model);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
};

/**
 * Creates an LLMClient instance based on the provided ApplicationConfig.
 */
export const createLLMClient = async (config: ApplicationConfig): Promise<LLMClient> => {
    if (!config.llm) {
        throw new Error('LLM configuration is missing in the application config.');
    }

    const { provider, model, apiKey } = config.llm;
    const modelInstance = createModel(provider, model, apiKey);
    const llmClient: LLMClient = new AISDKLLMClient(modelInstance);

    return Promise.resolve(llmClient);
};
