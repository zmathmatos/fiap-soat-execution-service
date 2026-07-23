import { Request, Response } from "express";
import { StartExecution } from "../../application/use-cases/StartExecution";
import { FinishExecution } from "../../application/use-cases/FinishExecution";
import { FailExecution } from "../../application/use-cases/FailExecution";
import { GetExecutionOrder } from "../../application/use-cases/GetExecutionOrder";
import { ValidationError } from "./errorHandler";
export class ExecutionController {
    constructor(private readonly startExecution: StartExecution, private readonly finishExecution: FinishExecution, private readonly failExecution: FailExecution, private readonly getExecutionOrder: GetExecutionOrder) { }
    async getById(req: Request, res: Response): Promise<void> {
        const dto = await this.getExecutionOrder.execute(req.params.serviceOrderId as string);
        res.status(200).json(dto);
    }
    async start(req: Request, res: Response): Promise<void> {
        const serviceOrderId = req.params.serviceOrderId as string;
        await this.startExecution.execute({ serviceOrderId });
        res.status(200).json(await this.getExecutionOrder.execute(serviceOrderId));
    }
    async finish(req: Request, res: Response): Promise<void> {
        const serviceOrderId = req.params.serviceOrderId as string;
        await this.finishExecution.execute({ serviceOrderId });
        res.status(200).json(await this.getExecutionOrder.execute(serviceOrderId));
    }
    async fail(req: Request, res: Response): Promise<void> {
        const serviceOrderId = req.params.serviceOrderId as string;
        const reason = (req.body as {
            reason?: string;
        })?.reason;
        if (!reason || typeof reason !== "string" || !reason.trim()) {
            throw new ValidationError("Body must contain a non-empty \"reason\"");
        }
        await this.failExecution.execute({ serviceOrderId, reason });
        res.status(200).json(await this.getExecutionOrder.execute(serviceOrderId));
    }
}
