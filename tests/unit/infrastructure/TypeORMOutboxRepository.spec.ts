import { DataSource, IsNull } from "typeorm";
import { TypeORMOutboxRepository } from "../../../src/infrastructure/database/typeorm/repositories/TypeORMOutboxRepository";
import { TypeORMExecutionOrderRepository } from "../../../src/infrastructure/database/typeorm/repositories/TypeORMExecutionOrderRepository";
import { OutboxEventEntity } from "../../../src/infrastructure/database/typeorm/entities/OutboxEventEntity";
import { ExecutionOrderEntity } from "../../../src/infrastructure/database/typeorm/entities/ExecutionOrderEntity";
import { ExecutionOrder } from "../../../src/domain/entities/ExecutionOrder";
import { Diagnosis } from "../../../src/domain/value-objects/Diagnosis";

function makeDataSource(repo: Record<string, jest.Mock>) {
    return {
        getRepository: jest.fn().mockReturnValue(repo),
        transaction: jest.fn(),
        query: jest.fn(),
        options: { schema: "execution" },
    } as unknown as DataSource;
}

describe("TypeORMOutboxRepository", () => {
    it("returns the oldest unpublished events mapped to the domain shape", async () => {
        const createdAt = new Date("2026-07-22T10:00:00.000Z");
        const find = jest.fn().mockResolvedValue([
            { id: "evt-1", eventType: "diagnostic.finished", payload: { serviceOrderId: "os-1" }, createdAt },
        ]);
        const sut = new TypeORMOutboxRepository(makeDataSource({ find, update: jest.fn() }));

        const events = await sut.findUnpublished();

        expect(find).toHaveBeenCalledWith({
            where: { publishedAt: IsNull() },
            order: { createdAt: "ASC" },
            take: 10,
        });
        expect(events).toEqual([
            { id: "evt-1", type: "diagnostic.finished", payload: { serviceOrderId: "os-1" }, createdAt },
        ]);
    });

    it("returns an empty list when nothing is pending", async () => {
        const find = jest.fn().mockResolvedValue([]);
        const sut = new TypeORMOutboxRepository(makeDataSource({ find, update: jest.fn() }));

        await expect(sut.findUnpublished()).resolves.toEqual([]);
    });

    it("stamps publishedAt when marking an event as published", async () => {
        const update = jest.fn().mockResolvedValue(undefined);
        const sut = new TypeORMOutboxRepository(makeDataSource({ find: jest.fn(), update }));

        await sut.markPublished("evt-1");

        expect(update).toHaveBeenCalledWith("evt-1", { publishedAt: expect.any(Date) });
    });
});

describe("TypeORMExecutionOrderRepository.atomicSaveWithEvent", () => {
    function makeSut() {
        const manager = { save: jest.fn().mockResolvedValue(undefined) };
        const dataSource = makeDataSource({ save: jest.fn(), findOneBy: jest.fn(), find: jest.fn() });
        (dataSource.transaction as unknown as jest.Mock).mockImplementation(
            (fn: (m: typeof manager) => Promise<void>) => fn(manager),
        );
        return { sut: new TypeORMExecutionOrderRepository(dataSource), manager, dataSource };
    }

    it("writes the order and the outbox row inside a single transaction", async () => {
        const { sut, manager, dataSource } = makeSut();
        const order = ExecutionOrder.receive({ serviceOrderId: "os-1", serviceOrderNumber: 1, queueSeq: 1 });

        await sut.atomicSaveWithEvent(order, {
            type: "diagnostic.finished",
            payload: { serviceOrderId: "os-1" },
        });

        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(manager.save).toHaveBeenCalledTimes(2);
        expect(manager.save).toHaveBeenNthCalledWith(1, ExecutionOrderEntity, expect.objectContaining({ serviceOrderId: "os-1" }));
        expect(manager.save).toHaveBeenNthCalledWith(
            2,
            OutboxEventEntity,
            expect.objectContaining({
                eventType: "diagnostic.finished",
                payload: { serviceOrderId: "os-1" },
                publishedAt: null,
                id: expect.any(String),
                createdAt: expect.any(Date),
            }),
        );
    });

    it("propagates the failure and rolls back when the transaction throws", async () => {
        const { sut, dataSource } = makeSut();
        (dataSource.transaction as unknown as jest.Mock).mockRejectedValue(new Error("deadlock"));
        const order = ExecutionOrder.receive({ serviceOrderId: "os-1", serviceOrderNumber: 1, queueSeq: 1 });

        await expect(
            sut.atomicSaveWithEvent(order, { type: "execution.finished", payload: {} }),
        ).rejects.toThrow("deadlock");
    });
});

describe("TypeORMExecutionOrderRepository queries", () => {
    const order = ExecutionOrder.receive({ serviceOrderId: "os-1", serviceOrderNumber: 7, queueSeq: 3 });
    const entity = {
        ...order.toState(),
        queueSeq: "3",
        diagnosis: null,
    };

    it("saves an order through the plain repository", async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const sut = new TypeORMExecutionOrderRepository(makeDataSource({ save, findOneBy: jest.fn(), find: jest.fn() }));

        await sut.save(order);

        expect(save).toHaveBeenCalledWith(expect.objectContaining({ serviceOrderId: "os-1", queueSeq: "3" }));
    });

    it("maps the entity back to the domain when the order exists", async () => {
        const findOneBy = jest.fn().mockResolvedValue(entity);
        const sut = new TypeORMExecutionOrderRepository(makeDataSource({ save: jest.fn(), findOneBy, find: jest.fn() }));

        const found = await sut.findByServiceOrderId("os-1");

        expect(findOneBy).toHaveBeenCalledWith({ serviceOrderId: "os-1" });
        expect(found?.serviceOrderId).toBe("os-1");
        expect(found?.queueSeq).toBe(3);
    });

    it("returns null when the order is unknown", async () => {
        const findOneBy = jest.fn().mockResolvedValue(null);
        const sut = new TypeORMExecutionOrderRepository(makeDataSource({ save: jest.fn(), findOneBy, find: jest.fn() }));

        await expect(sut.findByServiceOrderId("ghost")).resolves.toBeNull();
    });

    it("reads a queue ordered by queueSeq so FIFO is preserved", async () => {
        const find = jest.fn().mockResolvedValue([entity]);
        const sut = new TypeORMExecutionOrderRepository(makeDataSource({ save: jest.fn(), findOneBy: jest.fn(), find }));

        const queue = await sut.findQueue(order.status);

        expect(find).toHaveBeenCalledWith({ where: { status: order.status }, order: { queueSeq: "ASC" } });
        expect(queue).toHaveLength(1);
        expect(queue[0].serviceOrderId).toBe("os-1");
    });

    it("round-trips an order that already left the queue and carries a diagnosis", async () => {
        const diagnosed = ExecutionOrder.restore({
            ...order.toState(),
            queueSeq: null,
            diagnosis: new Diagnosis(
                [{ id: "p1", name: "Filter", quantity: 1, price: 50 }],
                [{ id: "s1", name: "Oil change", price: 120 }],
            ),
        });
        const save = jest.fn().mockResolvedValue(undefined);
        const sut = new TypeORMExecutionOrderRepository(makeDataSource({ save, findOneBy: jest.fn(), find: jest.fn() }));

        await sut.save(diagnosed);

        const persisted = save.mock.calls[0][0];
        expect(persisted.queueSeq).toBeNull();
        expect(persisted.diagnosis).toEqual({
            parts: [{ id: "p1", name: "Filter", quantity: 1, price: 50 }],
            services: [{ id: "s1", name: "Oil change", price: 120 }],
        });

        const findOneBy = jest.fn().mockResolvedValue(persisted);
        const reader = new TypeORMExecutionOrderRepository(makeDataSource({ save: jest.fn(), findOneBy, find: jest.fn() }));
        const restored = await reader.findByServiceOrderId("os-1");

        expect(restored?.queueSeq).toBeNull();
        expect(restored?.diagnosis?.parts).toHaveLength(1);
    });

    it("pulls the next queue position from the schema-qualified sequence", async () => {
        const dataSource = makeDataSource({ save: jest.fn(), findOneBy: jest.fn(), find: jest.fn() });
        (dataSource.query as unknown as jest.Mock).mockResolvedValue([{ nextval: "42" }]);
        const sut = new TypeORMExecutionOrderRepository(dataSource);

        await expect(sut.nextQueueSeq()).resolves.toBe(42);
        expect(dataSource.query).toHaveBeenCalledWith(`SELECT nextval('"execution"."queue_seq"')`);
    });
});
