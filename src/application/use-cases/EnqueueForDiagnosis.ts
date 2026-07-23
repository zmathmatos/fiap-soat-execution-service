import { ExecutionOrder } from "../../domain/entities/ExecutionOrder";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
interface Input {
    serviceOrderId: string;
    serviceOrderNumber: number;
}
export class EnqueueForDiagnosis {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute({ serviceOrderId, serviceOrderNumber }: Input): Promise<void> {
        const existing = await this.repository.findByServiceOrderId(serviceOrderId);
        if (existing)
            return;
        const queueSeq = await this.repository.nextQueueSeq();
        const order = ExecutionOrder.receive({ serviceOrderId, serviceOrderNumber, queueSeq });
        await this.repository.save(order);
    }
}
