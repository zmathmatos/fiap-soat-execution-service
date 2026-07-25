import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
import { IEventPublisher } from "../ports/IEventPublisher";
interface Input {
    serviceOrderId: string;
    reason: string;
}
export class FailExecution {
    constructor(private readonly repository: IExecutionOrderRepository, private readonly publisher: IEventPublisher) { }
    async execute({ serviceOrderId, reason }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        order.fail(reason);
        await this.repository.save(order);
        await this.publisher.publishExecutionFailed({
            serviceOrderId,
            reason,
            failedAt: order.failedAt!.toISOString()
        });
    }
}
