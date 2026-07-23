import { ConsumeMessage } from "amqplib";
import { RabbitMQEventPublisher } from "../../../src/infrastructure/messaging/RabbitMQEventPublisher";
import { ServiceOrderEventsConsumer } from "../../../src/infrastructure/messaging/ServiceOrderEventsConsumer";
import { PaymentEventsConsumer } from "../../../src/infrastructure/messaging/PaymentEventsConsumer";
import { EnqueueForDiagnosis } from "../../../src/application/use-cases/EnqueueForDiagnosis";
import { RegisterDiagnosis } from "../../../src/application/use-cases/RegisterDiagnosis";
import { EnqueueForExecution } from "../../../src/application/use-cases/EnqueueForExecution";
import { CancelExecution } from "../../../src/application/use-cases/CancelExecution";
import { ExecutionOrderStatus } from "../../../src/domain/entities/ExecutionOrder";
import { InMemoryExecutionOrderRepository } from "../../fakes/InMemoryExecutionOrderRepository";
import { InMemoryProcessedEventRepository } from "../../fakes/InMemoryProcessedEventRepository";
type ConsumeHandler = (msg: ConsumeMessage | null) => void;
function makeFakeChannel() {
    const handlers = new Map<string, ConsumeHandler>();
    const channel = {
        assertExchange: jest.fn().mockResolvedValue(undefined),
        assertQueue: jest.fn().mockResolvedValue(undefined),
        bindQueue: jest.fn().mockResolvedValue(undefined),
        prefetch: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockReturnValue(true),
        consume: jest.fn().mockImplementation((queue: string, handler: ConsumeHandler) => {
            handlers.set(queue, handler);
            return Promise.resolve({ consumerTag: "tag" });
        }),
        ack: jest.fn(),
        nack: jest.fn()
    };
    return { channel, handlers };
}
function makeMessage(routingKey: string, payload: unknown, messageId?: string): ConsumeMessage {
    return {
        content: Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)),
        fields: { routingKey } as ConsumeMessage["fields"],
        properties: { messageId } as ConsumeMessage["properties"]
    } as ConsumeMessage;
}
function flush(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}
describe("RabbitMQEventPublisher", () => {
    it("publishes execution.finished to the execution-events exchange", async () => {
        const { channel } = makeFakeChannel();
        const publisher = new RabbitMQEventPublisher(channel as never);
        await publisher.publishExecutionFinished({
            serviceOrderId: "os-1",
            finishedAt: "2026-07-22T10:00:00.000Z"
        });
        expect(channel.publish).toHaveBeenCalledWith("execution-events", "execution.finished", expect.any(Buffer), expect.objectContaining({ persistent: true, messageId: expect.any(String) }));
        const body = JSON.parse(channel.publish.mock.calls[0][2].toString());
        expect(body).toEqual({ serviceOrderId: "os-1", finishedAt: "2026-07-22T10:00:00.000Z" });
    });
    it("publishes execution.failed with the failure reason", async () => {
        const { channel } = makeFakeChannel();
        const publisher = new RabbitMQEventPublisher(channel as never);
        await publisher.publishExecutionFailed({
            serviceOrderId: "os-1",
            reason: "broken",
            failedAt: "2026-07-22T10:00:00.000Z"
        });
        expect(channel.publish).toHaveBeenCalledWith("execution-events", "execution.failed", expect.any(Buffer), expect.anything());
    });
});
function makeConsumers() {
    const repo = new InMemoryExecutionOrderRepository();
    const processed = new InMemoryProcessedEventRepository();
    const { channel, handlers } = makeFakeChannel();
    const serviceOrderConsumer = new ServiceOrderEventsConsumer(channel as never, processed, new EnqueueForDiagnosis(repo), new RegisterDiagnosis(repo));
    const paymentConsumer = new PaymentEventsConsumer(channel as never, processed, new EnqueueForExecution(repo), new CancelExecution(repo));
    return { repo, processed, channel, handlers, serviceOrderConsumer, paymentConsumer };
}
describe("ServiceOrderEventsConsumer", () => {
    it("binds queue to order.received and diagnostic.finished", async () => {
        const { channel, serviceOrderConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        expect(channel.assertExchange).toHaveBeenCalledWith("service-order-events", "topic", {
            durable: true
        });
        expect(channel.bindQueue).toHaveBeenCalledWith("execution-service.service-order-events", "service-order-events", "order.received");
        expect(channel.bindQueue).toHaveBeenCalledWith("execution-service.service-order-events", "service-order-events", "diagnostic.finished");
    });
    it("enqueues an order for diagnosis on order.received and acks", async () => {
        const { repo, channel, handlers, serviceOrderConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        handlers.get("execution-service.service-order-events")!(makeMessage("order.received", { serviceOrderId: "os-1", serviceOrderNumber: 1 }, "m1"));
        await flush();
        const order = await repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
        expect(channel.ack).toHaveBeenCalled();
    });
    it("registers diagnosis on diagnostic.finished", async () => {
        const { repo, handlers, serviceOrderConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        const handler = handlers.get("execution-service.service-order-events")!;
        handler(makeMessage("order.received", { serviceOrderId: "os-1", serviceOrderNumber: 1 }, "m1"));
        await flush();
        handler(makeMessage("diagnostic.finished", {
            serviceOrderId: "os-1",
            parts: [{ id: "p1", name: "Filter", quantity: 1, price: 50 }],
            services: []
        }, "m2"));
        await flush();
        const order = await repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.AWAITING_PAYMENT);
    });
    it("skips duplicate messages (same messageId) with ack", async () => {
        const { repo, channel, handlers, serviceOrderConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        const handler = handlers.get("execution-service.service-order-events")!;
        const msg = makeMessage("order.received", { serviceOrderId: "os-1", serviceOrderNumber: 1 }, "dup");
        handler(msg);
        await flush();
        handler(msg);
        await flush();
        const queue = await repo.findQueue(ExecutionOrderStatus.IN_DIAGNOSIS_QUEUE);
        expect(queue).toHaveLength(1);
        expect(channel.ack).toHaveBeenCalledTimes(2);
        expect(channel.nack).not.toHaveBeenCalled();
    });
    it("drops permanently failing messages without requeue (unknown order)", async () => {
        const { channel, handlers, serviceOrderConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        handlers.get("execution-service.service-order-events")!(makeMessage("diagnostic.finished", { serviceOrderId: "ghost", parts: [], services: [] }, "m3"));
        await flush();
        expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    });
    it("drops malformed JSON without requeue", async () => {
        const { channel, handlers, serviceOrderConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        handlers.get("execution-service.service-order-events")!(makeMessage("order.received", "{not json", "m4"));
        await flush();
        expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    });
    it("requeues on transient failures (repository unavailable)", async () => {
        const { repo, channel, handlers, serviceOrderConsumer } = makeConsumers();
        jest.spyOn(repo, "findByServiceOrderId").mockRejectedValueOnce(new Error("ECONNREFUSED"));
        await serviceOrderConsumer.start();
        handlers.get("execution-service.service-order-events")!(makeMessage("order.received", { serviceOrderId: "os-1", serviceOrderNumber: 1 }, "m5"));
        await flush();
        expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    });
});
describe("PaymentEventsConsumer", () => {
    it("moves order to the execution queue on payment.approved", async () => {
        const { repo, handlers, serviceOrderConsumer, paymentConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        await paymentConsumer.start();
        const soHandler = handlers.get("execution-service.service-order-events")!;
        soHandler(makeMessage("order.received", { serviceOrderId: "os-1", serviceOrderNumber: 1 }, "a1"));
        await flush();
        soHandler(makeMessage("diagnostic.finished", { serviceOrderId: "os-1", parts: [], services: [] }, "a2"));
        await flush();
        handlers.get("execution-service.payment-events")!(makeMessage("payment.approved", { serviceOrderId: "os-1" }, "a3"));
        await flush();
        const order = await repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.IN_EXECUTION_QUEUE);
    });
    it("cancels order on payment.failed (saga compensation)", async () => {
        const { repo, handlers, serviceOrderConsumer, paymentConsumer } = makeConsumers();
        await serviceOrderConsumer.start();
        await paymentConsumer.start();
        const soHandler = handlers.get("execution-service.service-order-events")!;
        soHandler(makeMessage("order.received", { serviceOrderId: "os-1", serviceOrderNumber: 1 }, "b1"));
        await flush();
        soHandler(makeMessage("diagnostic.finished", { serviceOrderId: "os-1", parts: [], services: [] }, "b2"));
        await flush();
        handlers.get("execution-service.payment-events")!(makeMessage("payment.failed", { serviceOrderId: "os-1" }, "b3"));
        await flush();
        const order = await repo.findByServiceOrderId("os-1");
        expect(order?.status).toBe(ExecutionOrderStatus.CANCELLED);
    });
});
