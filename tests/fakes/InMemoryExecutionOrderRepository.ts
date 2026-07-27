import { ExecutionOrder, ExecutionOrderStatus } from "../../src/domain/entities/ExecutionOrder";
import { OutboxEvent } from "../../src/domain/events/OutboxEvent";
import { IExecutionOrderRepository } from "../../src/domain/repositories/IExecutionOrderRepository";
export class InMemoryExecutionOrderRepository implements IExecutionOrderRepository {
    private readonly orders = new Map<string, ExecutionOrder>();
    private seq = 0;
    readonly pendingEvents: OutboxEvent[] = [];
    async save(order: ExecutionOrder): Promise<void> {
        this.orders.set(order.serviceOrderId, order);
    }
    async atomicSaveWithEvent(order: ExecutionOrder, event: OutboxEvent): Promise<void> {
        this.orders.set(order.serviceOrderId, order);
        this.pendingEvents.push(event);
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
