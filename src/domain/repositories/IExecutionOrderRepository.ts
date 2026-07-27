import { ExecutionOrder, ExecutionOrderStatus } from "../entities/ExecutionOrder";
import { OutboxEvent } from "../events/OutboxEvent";
export interface IExecutionOrderRepository {
    save(order: ExecutionOrder): Promise<void>;
    atomicSaveWithEvent(order: ExecutionOrder, event: OutboxEvent): Promise<void>;
    findByServiceOrderId(serviceOrderId: string): Promise<ExecutionOrder | null>;
    findQueue(status: ExecutionOrderStatus): Promise<ExecutionOrder[]>;
    nextQueueSeq(): Promise<number>;
}
