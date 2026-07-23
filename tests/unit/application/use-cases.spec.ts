import { ExecutionOrderStatus } from "../../../src/domain/entities/ExecutionOrder";
import { NotFoundError } from "../../../src/domain/errors/NotFoundError";
import { NotHeadOfQueueError } from "../../../src/domain/errors/NotHeadOfQueueError";
import { EnqueueForDiagnosis } from "../../../src/application/use-cases/EnqueueForDiagnosis";
import { RegisterDiagnosis } from "../../../src/application/use-cases/RegisterDiagnosis";
import { EnqueueForExecution } from "../../../src/application/use-cases/EnqueueForExecution";
import { CancelExecution } from "../../../src/application/use-cases/CancelExecution";
import { StartExecution } from "../../../src/application/use-cases/StartExecution";
import { FinishExecution } from "../../../src/application/use-cases/FinishExecution";
import { FailExecution } from "../../../src/application/use-cases/FailExecution";
import { GetQueue } from "../../../src/application/use-cases/GetQueue";
import { GetExecutionOrder } from "../../../src/application/use-cases/GetExecutionOrder";
import { InMemoryExecutionOrderRepository } from "../../fakes/InMemoryExecutionOrderRepository";
import { FakeEventPublisher } from "../../fakes/FakeEventPublisher";
const diagnosisPayload = {
    parts: [{ id: "p1", name: "Filter", quantity: 1, price: 50 }],
    services: [{ id: "s1", name: "Oil change", price: 120 }]
};
function makeSut() {
    const repo = new InMemoryExecutionOrderRepository();
    const publisher = new FakeEventPublisher();
    return {
        repo,
        publisher,
        enqueueForDiagnosis: new EnqueueForDiagnosis(repo),
        registerDiagnosis: new RegisterDiagnosis(repo),
        enqueueForExecution: new EnqueueForExecution(repo),
        cancelExecution: new CancelExecution(repo),
        startExecution: new StartExecution(repo),
        finishExecution: new FinishExecution(repo, publisher),
        failExecution: new FailExecution(repo, publisher),
        getQueue: new GetQueue(repo),
        getExecutionOrder: new GetExecutionOrder(repo)
    };
}
async function driveToExecutionQueue(sut: ReturnType<typeof makeSut>, id: string, num: number) {
    await sut.enqueueForDiagnosis.execute({ serviceOrderId: id, serviceOrderNumber: num });
    await sut.registerDiagnosis.execute({ serviceOrderId: id, ...diagnosisPayload });
    await sut.enqueueForExecution.execute({ serviceOrderId: id });
}
describe("EnqueueForDiagnosis", () => {
    it("appends the order to the diagnosis queue", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
    });
    it("is idempotent — duplicate event is a no-op", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        const queue = await sut.repo.findQueue(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
        expect(queue).toHaveLength(1);
    });
    it("keeps FIFO order across multiple orders", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-2", serviceOrderNumber: 2 });
        const queue = await sut.repo.findQueue(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
        expect(queue.map((o) => o.serviceOrderId)).toEqual(["os-1", "os-2"]);
    });
});
describe("RegisterDiagnosis", () => {
    it("stores parts/services and moves order to AWAITING_PAYMENT", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await sut.registerDiagnosis.execute({ serviceOrderId: "os-1", ...diagnosisPayload });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.AWAITING_PAYMENT);
        expect(order?.diagnosis?.parts).toEqual(diagnosisPayload.parts);
    });
    it("throws NotFoundError for unknown order", async () => {
        const sut = makeSut();
        await expect(sut.registerDiagnosis.execute({ serviceOrderId: "ghost", ...diagnosisPayload })).rejects.toThrow(NotFoundError);
    });
});
describe("EnqueueForExecution", () => {
    it("moves a paid order to the execution queue", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await sut.registerDiagnosis.execute({ serviceOrderId: "os-1", ...diagnosisPayload });
        await sut.enqueueForExecution.execute({ serviceOrderId: "os-1" });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
    });
    it("throws NotFoundError for unknown order", async () => {
        const sut = makeSut();
        await expect(sut.enqueueForExecution.execute({ serviceOrderId: "ghost" })).rejects.toThrow(NotFoundError);
    });
});
describe("CancelExecution", () => {
    it("cancels an order awaiting payment (saga compensation)", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await sut.registerDiagnosis.execute({ serviceOrderId: "os-1", ...diagnosisPayload });
        await sut.cancelExecution.execute({ serviceOrderId: "os-1" });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.CANCELLED);
    });
});
describe("StartExecution", () => {
    it("starts the head of the execution queue", async () => {
        const sut = makeSut();
        await driveToExecutionQueue(sut, "os-1", 1);
        await sut.startExecution.execute({ serviceOrderId: "os-1" });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.IN_EXECUTION);
    });
    it("rejects starting an order that is not the head (FIFO)", async () => {
        const sut = makeSut();
        await driveToExecutionQueue(sut, "os-1", 1);
        await driveToExecutionQueue(sut, "os-2", 2);
        await expect(sut.startExecution.execute({ serviceOrderId: "os-2" })).rejects.toThrow(NotHeadOfQueueError);
    });
});
describe("FinishExecution", () => {
    it("finishes the repair and publishes execution.finished", async () => {
        const sut = makeSut();
        await driveToExecutionQueue(sut, "os-1", 1);
        await sut.startExecution.execute({ serviceOrderId: "os-1" });
        await sut.finishExecution.execute({ serviceOrderId: "os-1" });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.FINISHED);
        expect(sut.publisher.finished).toEqual([
            { serviceOrderId: "os-1", finishedAt: expect.any(String) }
        ]);
    });
});
describe("FailExecution", () => {
    it("fails the repair and publishes execution.failed", async () => {
        const sut = makeSut();
        await driveToExecutionQueue(sut, "os-1", 1);
        await sut.startExecution.execute({ serviceOrderId: "os-1" });
        await sut.failExecution.execute({ serviceOrderId: "os-1", reason: "engine seized" });
        const order = await sut.repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.FAILED);
        expect(sut.publisher.failed).toEqual([
            { serviceOrderId: "os-1", reason: "engine seized", failedAt: expect.any(String) }
        ]);
    });
});
describe("GetQueue", () => {
    it("returns the diagnosis queue in FIFO order with positions", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-2", serviceOrderNumber: 2 });
        const queue = await sut.getQueue.execute("diagnosis");
        expect(queue.map((i) => [i.position, i.serviceOrderId])).toEqual([
            [1, "os-1"],
            [2, "os-2"]
        ]);
    });
    it("returns the execution queue", async () => {
        const sut = makeSut();
        await driveToExecutionQueue(sut, "os-1", 1);
        const queue = await sut.getQueue.execute("execution");
        expect(queue).toHaveLength(1);
        expect(queue[0].status).toBe(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
    });
});
describe("GetExecutionOrder", () => {
    it("returns order details", async () => {
        const sut = makeSut();
        await sut.enqueueForDiagnosis.execute({ serviceOrderId: "os-1", serviceOrderNumber: 1 });
        const dto = await sut.getExecutionOrder.execute("os-1");
        expect(dto.serviceOrderId).toBe("os-1");
        expect(dto.status).toBe(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
    });
    it("throws NotFoundError for unknown order", async () => {
        const sut = makeSut();
        await expect(sut.getExecutionOrder.execute("ghost")).rejects.toThrow(NotFoundError);
    });
});
