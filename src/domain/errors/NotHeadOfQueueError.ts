export type QueueLabel = "diagnosis" | "execution";
export class NotHeadOfQueueError extends Error {
    constructor(serviceOrderId: string, queue: QueueLabel) {
        super(`Service order "${serviceOrderId}" is not at the head of the ${queue} queue — FIFO order must be respected`);
        this.name = "NotHeadOfQueueError";
    }
}
