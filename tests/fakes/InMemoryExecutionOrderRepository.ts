import { ExecutionOrder, ExecutionOrderStatus } from "../../src/domain/entities/ExecutionOrder";
import { IExecutionOrderRepository } from "../../src/domain/repositories/IExecutionOrderRepository";
export class InMemoryExecutionOrderRepository implements IExecutionOrderRepository {
    private readonly orders = new Map<string, ExecutionOrder>();
    private seq = 0;
    async save(order: ExecutionOrder): Promise<void> {
        this.orders.set(order.serviceOrderId, order);
    }
    async findByServiceOrderId(serviceOrderId: string): Promise<ExecutionOrder | null> {
        return this.orders.get(serviceOrderId) ?? null;
    }
    async findQueue(status: ExecutionOrderStatus): Promise<ExecutionOrder[]> {
        return [...this.orders.values()]
            .filter((o) => o.status === status)
            .sort((a, b) => (a.queueSeq ?? 0) - (b.queueSeq ?? 0));
    }
    async nextQueueSeq(): Promise<number> {
        return ++this.seq;
    }
}
