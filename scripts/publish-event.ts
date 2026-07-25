import amqplib from "amqplib";
import { randomUUID } from "crypto";
import { env } from "../src/infrastructure/config/env";
// Simulates the neighbouring services: os-service (order.received) and
// billing-service (payment.*/quotation.rejected). diagnostic.finished is NOT here —
// it is published by this service when the mechanic registers the diagnosis.
const EXCHANGES: Record<string, string> = {
    "order.received": env.rabbitmq.serviceOrderExchange,
    "payment.approved": env.rabbitmq.paymentExchange,
    "payment.failed": env.rabbitmq.paymentExchange,
    "quotation.rejected": env.rabbitmq.paymentExchange
};
function buildPayload(routingKey: string, serviceOrderId: string, serviceOrderNumber: number) {
    switch (routingKey) {
        case "order.received":
            return { serviceOrderId, serviceOrderNumber };
        case "payment.approved":
        case "payment.failed":
        case "quotation.rejected":
            return { serviceOrderId };
        default:
            throw new Error(`Unknown event "${routingKey}"`);
    }
}
async function main(): Promise<void> {
    const [routingKey, serviceOrderId, numberArg] = process.argv.slice(2);
    if (!routingKey || !serviceOrderId || !EXCHANGES[routingKey]) {
        console.error("Usage: npm run publish-event -- <order.received|payment.approved|payment.failed|quotation.rejected> <serviceOrderId> [serviceOrderNumber]");
        process.exit(1);
    }
    const exchange = EXCHANGES[routingKey];
    const payload = buildPayload(routingKey, serviceOrderId, Number(numberArg ?? 1));
    const connection = await amqplib.connect(env.rabbitmq.url);
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, "topic", { durable: true });
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        messageId: randomUUID(),
        contentType: "application/json"
    });
    console.log(`Published "${routingKey}" to exchange "${exchange}":`);
    console.log(JSON.stringify(payload, null, 2));
    await channel.close();
    await connection.close();
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
