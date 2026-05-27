import type { Engine } from '../Engine/Engine.js';

/**
 * UI-agnostic interface for receiving messages from UI and transferring them to the engine.
 * Implementations handle different UI channels (console, web, chat bot).
 */
export interface IOChannelListener {
    /** Start listening for UI channel and transferring messages to the engine */
    attachEngine(engine: Engine): void;
}
