import { Channel } from "amqplib";
import { randomUUID } from "crypto";
import { IEventPublisher } from "../../application/ports/IEventPublisher";
import { ExecutionFailedEvent, ExecutionFinishedEvent } from "../../domain/events/IntegrationEvents";
import { env } from "../config/env";
import { logger } from "../logger";
export class RabbitMQEventPublisher implements IEventPublisher {
    constructor(private readonly channel: Channel) { }
    async publishExecutionFinished(event: ExecutionFinishedEvent): Promise<void> {
        await this.publish("execution.finished", event);
    }
    async publishExecutionFailed(event: ExecutionFailedEvent): Promise<void> {
        await this.publish("execution.failed", event);
    }
    private async publish(routingKey: string, payload: object): Promise<void> {
        await this.channel.assertExchange(env.rabbitmq.executionExchange, "topic", { durable: true });
        this.channel.publish(env.rabbitmq.executionExchange, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true, messageId: randomUUID(), contentType: "application/json" });
        logger.info({ routingKey, payload }, "Event published");
    }
}
