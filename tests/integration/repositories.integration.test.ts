import { DataSource } from "typeorm";
import { AppDataSource, initializeDatabase } from "../../src/infrastructure/database/typeorm/data-source";
import { TypeORMExecutionOrderRepository } from "../../src/infrastructure/database/typeorm/repositories/TypeORMExecutionOrderRepository";
import { TypeORMProcessedEventRepository } from "../../src/infrastructure/database/typeorm/repositories/TypeORMProcessedEventRepository";
import { ExecutionOrder, ExecutionOrderStatus } from "../../src/domain/entities/ExecutionOrder";
import { Diagnosis } from "../../src/domain/value-objects/Diagnosis";
import { randomUUID } from "crypto";
describe("TypeORM repositories (integration)", () => {
    let dataSource: DataSource;
    let orders: TypeORMExecutionOrderRepository;
    let events: TypeORMProcessedEventRepository;
    beforeAll(async () => {
        dataSource = await initializeDatabase(AppDataSource);
        orders = new TypeORMExecutionOrderRepository(dataSource);
        events = new TypeORMProcessedEventRepository(dataSource);
    });
    afterAll(async () => {
        await dataSource?.destroy();
    });
    beforeEach(async () => {
        const schema = (dataSource.options as {
            schema?: string;
        }).schema ?? "execution";
        await dataSource.query(`TRUNCATE "${schema}"."execution_orders", "${schema}"."processed_events"`);
    });
    it("persists and rehydrates an execution order through its lifecycle", async () => {
        const serviceOrderId = randomUUID();
        const order = ExecutionOrder.receive({
            serviceOrderId,
            serviceOrderNumber: 10,
            queueSeq: await orders.nextQueueSeq()
        });
        await orders.save(order);
        const loaded = await orders.findByServiceOrderId(serviceOrderId);
        expect(loaded?.status).toBe(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
        loaded!.registerDiagnosis(new Diagnosis([{ id: "p1", name: "Filter", quantity: 1, price: 50 }], [{ id: "s1", name: "Oil change", price: 120 }]));
        await orders.save(loaded!);
        const diagnosed = await orders.findByServiceOrderId(serviceOrderId);
        expect(diagnosed?.status).toBe(ExecutionOrderStatus.AWAITING_PAYMENT);
        expect(diagnosed?.diagnosis?.parts[0].name).toBe("Filter");
    });
    it("returns queues in FIFO order by queue_seq", async () => {
        const first = randomUUID();
        const second = randomUUID();
        await orders.save(ExecutionOrder.receive({
            serviceOrderId: first,
            serviceOrderNumber: 1,
            queueSeq: await orders.nextQueueSeq()
        }));
        await orders.save(ExecutionOrder.receive({
            serviceOrderId: second,
            serviceOrderNumber: 2,
            queueSeq: await orders.nextQueueSeq()
        }));
        const queue = await orders.findQueue(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
        expect(queue.map((o) => o.serviceOrderId)).toEqual([first, second]);
    });
    it("nextQueueSeq is monotonically increasing", async () => {
        const a = await orders.nextQueueSeq();
        const b = await orders.nextQueueSeq();
        expect(b).toBeGreaterThan(a);
    });
    it("deduplicates processed events", async () => {
        const messageId = randomUUID();
        expect(await events.wasProcessed(messageId)).toBe(false);
        await events.markProcessed(messageId, "order.received");
        expect(await events.wasProcessed(messageId)).toBe(true);
    });
});
