import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../../domain/errors/NotFoundError";
import { InvalidTransitionError } from "../../domain/errors/InvalidTransitionError";
import { NotHeadOfQueueError } from "../../domain/errors/NotHeadOfQueueError";
import { logger } from "../../infrastructure/logger";
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}
export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction): void {
    if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
    }
    if (error instanceof InvalidTransitionError || error instanceof NotHeadOfQueueError) {
        res.status(409).json({ error: error.message });
        return;
    }
    if (error instanceof ValidationError) {
        res.status(422).json({ error: error.message });
        return;
    }
    logger.error({ err: error }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
}
