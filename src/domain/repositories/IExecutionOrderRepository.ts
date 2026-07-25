import { ExecutionOrder, ExecutionOrderStatus } from "../entities/ExecutionOrder";
export interface IExecutionOrderRepository {
    save(order: ExecutionOrder): Promise<void>;
    findByServiceOrderId(serviceOrderId: string): Promise<ExecutionOrder | null>;
    findQueue(status: ExecutionOrderStatus): Promise<ExecutionOrder[]>;
    nextQueueSeq(): Promise<number>;
}
