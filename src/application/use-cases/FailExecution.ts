import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
    reason: string;
}
export class FailExecution {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId, reason }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        order.fail(reason);
        await this.repository.atomicSaveWithEvent(order, {
            type: "execution.failed",
            payload: { serviceOrderId, reason, failedAt: order.failedAt!.toISOString() },
        });
    }
}
