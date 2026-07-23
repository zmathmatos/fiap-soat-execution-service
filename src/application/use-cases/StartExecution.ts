import { ExecutionOrderStatus } from "../../domain/entities/ExecutionOrder";
import { NotFoundError } from "../../domain/errors/NotFoundError";
import { NotHeadOfQueueError } from "../../domain/errors/NotHeadOfQueueError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
}
export class StartExecution {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        const queue = await this.repository.findQueue(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
        const head = queue[0];
        if (!head || head.serviceOrderId !== serviceOrderId) {
            throw new NotHeadOfQueueError(serviceOrderId);
        }
        order.start();
        await this.repository.save(order);
    }
}
