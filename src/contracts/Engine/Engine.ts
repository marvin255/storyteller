import { IOMessageInbound } from "../IOChannel/IOMessageInbound.js";

export interface Engine {
    handle(message: IOMessageInbound | IOMessageInbound[]): void;
}
