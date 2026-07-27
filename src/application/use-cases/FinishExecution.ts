import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
}
export class FinishExecution {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        order.finish();
        await this.repository.atomicSaveWithEvent(order, {
            type: "execution.finished",
            payload: { serviceOrderId, finishedAt: order.finishedAt!.toISOString() },
        });
    }
}
