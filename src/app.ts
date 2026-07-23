import express, { Express, NextFunction, Request, Response } from "express";
import { StartExecution } from "./application/use-cases/StartExecution";
import { FinishExecution } from "./application/use-cases/FinishExecution";
import { FailExecution } from "./application/use-cases/FailExecution";
import { GetQueue } from "./application/use-cases/GetQueue";
import { GetExecutionOrder } from "./application/use-cases/GetExecutionOrder";
import { ExecutionController } from "./interface/http/ExecutionController";
import { QueueController } from "./interface/http/QueueController";
import { errorHandler } from "./interface/http/errorHandler";
export interface AppDependencies {
    startExecution: StartExecution;
    finishExecution: FinishExecution;
    failExecution: FailExecution;
    getQueue: GetQueue;
    getExecutionOrder: GetExecutionOrder;
    health: () => Promise<{
        database: boolean;
        rabbitmq: boolean;
    }>;
}
type AsyncHandler = (req: Request, res: Response) => Promise<void>;
function wrap(handler: AsyncHandler) {
    return (req: Request, res: Response, next: NextFunction) => {
        handler(req, res).catch(next);
    };
}
export function buildApp(deps: AppDependencies): Express {
    const app = express();
    app.use(express.json());
    const executionController = new ExecutionController(deps.startExecution, deps.finishExecution, deps.failExecution, deps.getExecutionOrder);
    const queueController = new QueueController(deps.getQueue);
    app.get("/health", wrap(async (_req, res) => {
        const status = await deps.health();
        res.status(200).json({ status: "ok", ...status });
    }));
    app.get("/api/queues/:queue", wrap((req, res) => queueController.list(req, res)));
    app.get("/api/executions/:serviceOrderId", wrap((req, res) => executionController.getById(req, res)));
    app.patch("/api/executions/:serviceOrderId/start", wrap((req, res) => executionController.start(req, res)));
    app.patch("/api/executions/:serviceOrderId/finish", wrap((req, res) => executionController.finish(req, res)));
    app.patch("/api/executions/:serviceOrderId/fail", wrap((req, res) => executionController.fail(req, res)));
    app.use(errorHandler);
    return app;
}
