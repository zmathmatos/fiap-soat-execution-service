import { ExecutionOrder, ExecutionOrderStatus } from "../../../src/domain/entities/ExecutionOrder";
import { Diagnosis } from "../../../src/domain/value-objects/Diagnosis";
import { InvalidTransitionError } from "../../../src/domain/errors/InvalidTransitionError";
const diagnosis = new Diagnosis([{ id: "part-1", name: "Brake pad", quantity: 2, price: 150 }], [{ id: "svc-1", name: "Brake replacement", price: 300 }]);
function receivedOrder(): ExecutionOrder {
    return ExecutionOrder.receive({
        serviceOrderId: "os-123",
        serviceOrderNumber: 42,
        queueSeq: 1
    });
}
function awaitingPaymentOrder(): ExecutionOrder {
    const order = receivedOrder();
    order.registerDiagnosis(diagnosis);
    return order;
}
function inExecutionQueueOrder(): ExecutionOrder {
    const order = awaitingPaymentOrder();
    order.enqueueForExecution(2);
    return order;
}
function inExecutionOrder(): ExecutionOrder {
    const order = inExecutionQueueOrder();
    order.start();
    return order;
}
describe("ExecutionOrder", () => {
    describe("receive", () => {
        it("enters the diagnosis queue with FIFO seq", () => {
            const order = receivedOrder();
            expect(order.status).toBe(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
            expect(order.serviceOrderId).toBe("os-123");
            expect(order.serviceOrderNumber).toBe(42);
            expect(order.queueSeq).toBe(1);
            expect(order.enqueuedAt).toBeInstanceOf(Date);
            expect(order.id).toEqual(expect.any(String));
        });
    });
    describe("registerDiagnosis", () => {
        it("stores diagnosis and moves to AWAITING_PAYMENT, leaving the queue", () => {
            const order = receivedOrder();
            order.registerDiagnosis(diagnosis);
            expect(order.status).toBe(ExecutionOrderStatus.AWAITING_PAYMENT);
            expect(order.diagnosis).toBe(diagnosis);
            expect(order.queueSeq).toBeNull();
        });
        it("rejects diagnosis when not in the diagnosis queue", () => {
            const order = awaitingPaymentOrder();
            expect(() => order.registerDiagnosis(diagnosis)).toThrow(InvalidTransitionError);
        });
    });
    describe("enqueueForExecution", () => {
        it("moves to the execution queue with a fresh FIFO seq", () => {
            const order = awaitingPaymentOrder();
            order.enqueueForExecution(7);
            expect(order.status).toBe(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
            expect(order.queueSeq).toBe(7);
        });
        it("rejects payment approval before diagnosis", () => {
            const order = receivedOrder();
            expect(() => order.enqueueForExecution(7)).toThrow(InvalidTransitionError);
        });
    });
    describe("cancel", () => {
        it("cancels while awaiting payment (saga compensation)", () => {
            const order = awaitingPaymentOrder();
            order.cancel();
            expect(order.status).toBe(ExecutionOrderStatus.CANCELLED);
        });
        it("rejects cancellation once in the execution queue", () => {
            const order = inExecutionQueueOrder();
            expect(() => order.cancel()).toThrow(InvalidTransitionError);
        });
    });
    describe("start", () => {
        it("starts repair from the execution queue", () => {
            const order = inExecutionQueueOrder();
            order.start();
            expect(order.status).toBe(ExecutionOrderStatus.IN_EXECUTION);
            expect(order.startedAt).toBeInstanceOf(Date);
            expect(order.queueSeq).toBeNull();
        });
        it("rejects start when not in the execution queue", () => {
            const order = awaitingPaymentOrder();
            expect(() => order.start()).toThrow(InvalidTransitionError);
        });
    });
    describe("finish", () => {
        it("finishes an in-progress repair", () => {
            const order = inExecutionOrder();
            order.finish();
            expect(order.status).toBe(ExecutionOrderStatus.FINISHED);
            expect(order.finishedAt).toBeInstanceOf(Date);
        });
        it("rejects finish when repair not started", () => {
            const order = inExecutionQueueOrder();
            expect(() => order.finish()).toThrow(InvalidTransitionError);
        });
    });
    describe("fail", () => {
        it("fails an in-progress repair with a reason", () => {
            const order = inExecutionOrder();
            order.fail("no parts in stock");
            expect(order.status).toBe(ExecutionOrderStatus.FAILED);
            expect(order.failedAt).toBeInstanceOf(Date);
            expect(order.failureReason).toBe("no parts in stock");
        });
        it("rejects fail when repair not started", () => {
            const order = inExecutionQueueOrder();
            expect(() => order.fail("x")).toThrow(InvalidTransitionError);
        });
    });
    describe("restore", () => {
        it("rehydrates an order from persistence without changing state", () => {
            const now = new Date();
            const order = ExecutionOrder.restore({
                id: "id-1",
                serviceOrderId: "os-9",
                serviceOrderNumber: 9,
                status: ExecutionOrderStatus.IN_EXECUTION_QUEUE,
                diagnosis,
                queueSeq: 5,
                enqueuedAt: now,
                startedAt: null,
                finishedAt: null,
                failedAt: null,
                failureReason: null,
                createdAt: now,
                updatedAt: now
            });
            expect(order.id).toBe("id-1");
            expect(order.status).toBe(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
            expect(order.queueSeq).toBe(5);
        });
    });
});
