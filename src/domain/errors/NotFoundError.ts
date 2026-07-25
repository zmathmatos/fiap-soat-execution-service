export class NotFoundError extends Error {
    constructor(serviceOrderId: string) {
        super(`Service order "${serviceOrderId}" not found in execution service`);
        this.name = "NotFoundError";
    }
}
