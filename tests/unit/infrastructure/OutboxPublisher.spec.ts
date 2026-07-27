import { OutboxPublisher } from "../../../src/infrastructure/messaging/OutboxPublisher";
import { IOutboxRepository } from "../../../src/domain/repositories/IOutboxRepository";
import { IEventPublisher } from "../../../src/application/ports/IEventPublisher";
import { StoredOutboxEvent } from "../../../src/domain/events/OutboxEvent";

const makeEvent = (overrides: Partial<StoredOutboxEvent> = {}): StoredOutboxEvent => ({
    id: "evt-1",
    type: "diagnostic.finished",
    payload: { serviceOrderId: "os-1", parts: [], services: [] },
    createdAt: new Date(),
    ...overrides,
});

const makeOutboxRepo = (): jest.Mocked<IOutboxRepository> => ({
    findUnpublished: jest.fn(),
    markPublished: jest.fn(),
});

const makeEventPublisher = (): jest.Mocked<IEventPublisher> => ({
    publishDiagnosticFinished: jest.fn(),
    publishExecutionFinished: jest.fn(),
    publishExecutionFailed: jest.fn(),
});

const flushMicrotasks = async (ticks = 8) => {
    for (let i = 0; i < ticks; i++) await Promise.resolve();
};

describe("OutboxPublisher", () => {
    let outboxRepo: jest.Mocked<IOutboxRepository>;
    let eventPublisher: jest.Mocked<IEventPublisher>;
    let publisher: OutboxPublisher;

    beforeEach(() => {
        jest.useFakeTimers();
        outboxRepo = makeOutboxRepo();
        eventPublisher = makeEventPublisher();
        publisher = new OutboxPublisher(outboxRepo, eventPublisher);

        outboxRepo.findUnpublished.mockResolvedValue([]);
        outboxRepo.markPublished.mockResolvedValue(undefined);
        eventPublisher.publishDiagnosticFinished.mockResolvedValue(undefined);
        eventPublisher.publishExecutionFinished.mockResolvedValue(undefined);
        eventPublisher.publishExecutionFailed.mockResolvedValue(undefined);
    });

    afterEach(() => {
        publisher.stop();
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it("starts polling on start()", async () => {
        publisher.start();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();
        expect(outboxRepo.findUnpublished).toHaveBeenCalledTimes(1);
    });

    it("publishes diagnostic.finished and marks it published", async () => {
        const event = makeEvent({ type: "diagnostic.finished" });
        outboxRepo.findUnpublished.mockResolvedValueOnce([event]);

        publisher.start();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();

        expect(eventPublisher.publishDiagnosticFinished).toHaveBeenCalledWith(event.payload);
        expect(outboxRepo.markPublished).toHaveBeenCalledWith("evt-1");
    });

    it("publishes execution.finished and marks it published", async () => {
        const event = makeEvent({ id: "evt-2", type: "execution.finished", payload: { serviceOrderId: "os-1", finishedAt: "2026-01-01T00:00:00.000Z" } });
        outboxRepo.findUnpublished.mockResolvedValueOnce([event]);

        publisher.start();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();

        expect(eventPublisher.publishExecutionFinished).toHaveBeenCalledWith(event.payload);
        expect(outboxRepo.markPublished).toHaveBeenCalledWith("evt-2");
    });

    it("publishes execution.failed and marks it published", async () => {
        const event = makeEvent({ id: "evt-3", type: "execution.failed", payload: { serviceOrderId: "os-1", reason: "broken", failedAt: "2026-01-01T00:00:00.000Z" } });
        outboxRepo.findUnpublished.mockResolvedValueOnce([event]);

        publisher.start();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();

        expect(eventPublisher.publishExecutionFailed).toHaveBeenCalledWith(event.payload);
        expect(outboxRepo.markPublished).toHaveBeenCalledWith("evt-3");
    });

    it("does not mark published when the broker publish fails", async () => {
        const event = makeEvent({ type: "diagnostic.finished" });
        outboxRepo.findUnpublished.mockResolvedValueOnce([event]);
        eventPublisher.publishDiagnosticFinished.mockRejectedValueOnce(new Error("broker down"));

        publisher.start();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();

        expect(outboxRepo.markPublished).not.toHaveBeenCalled();
    });

    it("continues polling after a DB error", async () => {
        outboxRepo.findUnpublished
            .mockRejectedValueOnce(new Error("postgres down"))
            .mockResolvedValue([]);

        publisher.start();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();

        expect(outboxRepo.findUnpublished).toHaveBeenCalledTimes(2);
    });

    it("stops polling after stop()", async () => {
        publisher.start();
        publisher.stop();
        jest.advanceTimersByTime(1000);
        await flushMicrotasks();

        expect(outboxRepo.findUnpublished).not.toHaveBeenCalled();
    });
});
