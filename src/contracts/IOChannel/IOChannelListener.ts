/**
 * UI-agnostic interface for receiving messages from the narrative engine.
 * Implementations handle different UI channels (console, web, mobile, etc.)
 */
export interface IOChannelListener {
    /** Start listening for outbound messages from the engine */
    listen(): void;
}
