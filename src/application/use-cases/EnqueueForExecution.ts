import { NotFoundError } from "../../domain/errors/NotFoundError";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
}
export class EnqueueForExecution {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId }: Input): Promise<void> {
        const order = await this.repository.findByServiceOrderId(serviceOrderId);
        if (!order)
            throw new NotFoundError(serviceOrderId);
        const queueSeq = await this.repository.nextQueueSeq();
        order.enqueueForExecution(queueSeq);
        await this.repository.save(order);
    }
}
