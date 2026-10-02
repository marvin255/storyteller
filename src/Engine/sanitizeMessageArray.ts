import type { IOMessageInbound } from '../Contracts/IOChannel/IOMessageInbound.js';
import type { Logger } from '../Contracts/Logger/Logger.js';

/* Check if the input is an array, if not, wrap it in an array */
const makeSureIsArray = (message: IOMessageInbound | IOMessageInbound[]): IOMessageInbound[] => {
    return Array.isArray(message) ? message : [message];
};

/* Filter out null or undefined messages from the array */
const filterNullMessages = (messages: IOMessageInbound[], logger?: Logger): IOMessageInbound[] => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const filteredMessages = messages.filter((msg) => msg !== null && msg !== undefined);
    if (filteredMessages.length === 0) {
        logger?.warn('Received an empty message array');
    }
    return filteredMessages;
};

/* Filter out duplicate messages based on their id */
const filterDuplicateMessages = (
    messages: IOMessageInbound[],
    logger?: Logger,
): IOMessageInbound[] => {
    const seen = new Set();
    return messages.filter((item) => {
        if (seen.has(item.id)) {
            logger?.warn(`Duplicate message detected with id: ${item.id}`);
            return false;
        }
        seen.add(item.id);
        return true;
    });
};

/* Filter messages to only include those with the same sessionId as the first message */
const filterSameSessionOnlyMessages = (
    messages: IOMessageInbound[],
    logger?: Logger,
): IOMessageInbound[] => {
    const expectedSessionId = messages[0]?.sessionId;
    if (!expectedSessionId) {
        return [];
    }
    const filteredMessages = messages.filter((msg) => {
        if (msg.sessionId !== expectedSessionId) {
            logger?.warn(
                `Message with id: ${msg.id} has a different sessionId: ${msg.sessionId} than expected: ${expectedSessionId}`,
            );
            return false;
        }
        return true;
    });
    return filteredMessages;
};

/* Sort messages by their createdAt timestamp in ascending order */
const sortMessagesByDate = (messages: IOMessageInbound[]): IOMessageInbound[] => {
    return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};

/**
 * Sanitize an array of IOMessageInbound and convert it into a clean array of IOMessageInbound.
 * This function ensures that the input is an array, filters out null or undefined messages,
 * removes duplicate messages based on their id, and sorts the messages by their createdAt timestamp.
 */
export const sanitizeMessageArray = (
    message: IOMessageInbound | IOMessageInbound[],
    logger?: Logger,
): IOMessageInbound[] => {
    let messagesArray = makeSureIsArray(message);
    messagesArray = filterNullMessages(messagesArray, logger);
    messagesArray = filterDuplicateMessages(messagesArray, logger);
    messagesArray = filterSameSessionOnlyMessages(messagesArray, logger);
    messagesArray = sortMessagesByDate(messagesArray);
    return messagesArray;
};
