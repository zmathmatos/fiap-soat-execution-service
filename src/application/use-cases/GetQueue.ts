import { ExecutionOrderStatus } from "../../domain/entities/ExecutionOrder";
import { IExecutionOrderRepository } from "../../domain/repositories/IExecutionOrderRepository";
import { QueueItemDTO, toDTO } from "../dtos/ExecutionOrderDTO";
export type QueueName = "diagnosis" | "execution";
const QUEUE_STATUS: Record<QueueName, ExecutionOrderStatus> = {
    diagnosis: ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE,
    execution: ExecutionOrderStatus.IN_EXECUTION_QUEUE
};
export class GetQueue {
    constructor(private readonly repository: IExecutionOrderRepository) { }
    async execute(queue: QueueName): Promise<QueueItemDTO[]> {
        const orders = await this.repository.findQueue(QUEUE_STATUS[queue]);
        return orders.map((order, index) => ({ ...toDTO(order), position: index + 1 }));
    }
}
