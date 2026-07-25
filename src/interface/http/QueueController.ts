import { Request, Response } from "express";
import { GetQueue, QueueName } from "../../application/use-cases/GetQueue";
import { ValidationError } from "./errorHandler";
const VALID_QUEUES: QueueName[] = ["diagnosis", "execution"];
export class QueueController {
    constructor(private readonly getQueue: GetQueue) { }
    async list(req: Request, res: Response): Promise<void> {
        const queue = req.params.queue as string;
        if (!VALID_QUEUES.includes(queue as QueueName)) {
            throw new ValidationError(`Unknown queue "${queue}" — valid queues: ${VALID_QUEUES.join(", ")}`);
        }
        res.status(200).json(await this.getQueue.execute(queue as QueueName));
    }
}
