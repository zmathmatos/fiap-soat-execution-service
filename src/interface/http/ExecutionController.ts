import { Request, Response } from "express";
import { RegisterDiagnosis } from "../../application/use-cases/RegisterDiagnosis";
import { StartExecution } from "../../application/use-cases/StartExecution";
import { FinishExecution } from "../../application/use-cases/FinishExecution";
import { FailExecution } from "../../application/use-cases/FailExecution";
import { GetExecutionOrder } from "../../application/use-cases/GetExecutionOrder";
import { DiagnosisPart, DiagnosisService } from "../../domain/value-objects/Diagnosis";
import { ValidationError } from "./errorHandler";
export class ExecutionController {
    constructor(private readonly registerDiagnosis: RegisterDiagnosis, private readonly startExecution: StartExecution, private readonly finishExecution: FinishExecution, private readonly failExecution: FailExecution, private readonly getExecutionOrder: GetExecutionOrder) { }
    async getById(req: Request, res: Response): Promise<void> {
        const dto = await this.getExecutionOrder.execute(req.params.serviceOrderId as string);
        res.status(200).json(dto);
    }
    async diagnose(req: Request, res: Response): Promise<void> {
        const serviceOrderId = req.params.serviceOrderId as string;
        const body = (req.body ?? {}) as {
            parts?: unknown;
            services?: unknown;
        };
        await this.registerDiagnosis.execute({
            serviceOrderId,
            parts: parseParts(body.parts),
            services: parseServices(body.services)
        });
        res.status(200).json(await this.getExecutionOrder.execute(serviceOrderId));
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
function asArray(value: unknown, field: string): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
        throw new ValidationError(`"${field}" must be an array`);
    }
    return value as Record<string, unknown>[];
}
function requireText(item: Record<string, unknown>, field: string, path: string): string {
    const value = item[field];
    if (typeof value !== "string" || !value.trim()) {
        throw new ValidationError(`"${path}.${field}" must be a non-empty string`);
    }
    return value;
}
function requireNumber(item: Record<string, unknown>, field: string, path: string, min: number): number {
    const value = item[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
        throw new ValidationError(`"${path}.${field}" must be a number >= ${min}`);
    }
    return value;
}
function parseParts(value: unknown): DiagnosisPart[] {
    return asArray(value, "parts").map((part, index) => ({
        id: requireText(part, "id", `parts[${index}]`),
        name: requireText(part, "name", `parts[${index}]`),
        quantity: requireNumber(part, "quantity", `parts[${index}]`, 1),
        price: requireNumber(part, "price", `parts[${index}]`, 0)
    }));
}
function parseServices(value: unknown): DiagnosisService[] {
    return asArray(value, "services").map((service, index) => ({
        id: requireText(service, "id", `services[${index}]`),
        name: requireText(service, "name", `services[${index}]`),
        price: requireNumber(service, "price", `services[${index}]`, 0)
    }));
}
