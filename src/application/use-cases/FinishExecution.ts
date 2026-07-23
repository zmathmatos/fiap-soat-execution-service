import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
import { IEventPublisher } from "../ports/IEventPublisher";
interface Input {
    serviceOrderId: string;
}
export class FinishExecution {
    constructor(private readonly repository: IExecutionOrderRepository, private readonly publisher: IEventPublisher) { }
    async execute({ serviceOrderId }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        order.finish();
        await this.repository.save(order);
        await this.publisher.publishExecutionFinished({
            serviceOrderId,
            finishedAt: order.finishedAt!.toISOString()
        });
    }
}
