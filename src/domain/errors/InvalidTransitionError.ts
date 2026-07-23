export class InvalidTransitionError extends Error {
    constructor(from: string, action: string) {
        super(`Cannot ${action} a service order in status "${from}"`);
        this.name = "InvalidTransitionError";
    }
}
