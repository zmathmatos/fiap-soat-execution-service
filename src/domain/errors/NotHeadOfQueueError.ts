export class NotHeadOfQueueError extends Error {
    constructor(serviceOrderId: string) {
        super(`Service order "${serviceOrderId}" is not at the head of the execution queue — FIFO order must be respected`);
        this.name = "NotHeadOfQueueError";
    }
}
