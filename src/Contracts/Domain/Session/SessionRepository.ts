import type { Id } from '../../Shared/Id.js';
import type { Session } from './Session.js';

/**
 * Provides access to persisted conversation sessions.
 */
export interface SessionRepository {
    /** Find a session by its unique identifier. */
    findSessionById(id: Id): Promise<Session | null>;
}
