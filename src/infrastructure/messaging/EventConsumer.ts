import { Channel, ConsumeMessage } from "amqplib";
import { randomUUID } from "crypto";
import { IProcessedEventRepository } from "../../domain/repositories/IProcessedEventRepository";
import { InvalidTransitionError } from "../../domain/errors/InvalidTransitionError";
import { NotFoundError } from "../../domain/errors/NotFoundError";
import { logger } from "../logger";
export interface ConsumerBinding {
    exchange: string;
    queue: string;
    routingKeys: string[];
}
export abstract class EventConsumer {
    constructor(private readonly channel: Channel, private readonly processedEvents: IProcessedEventRepository, private readonly binding: ConsumerBinding) { }
    protected abstract handle(routingKey: string, payload: unknown): Promise<void>;
    async start(): Promise<void> {
        const { exchange, queue, routingKeys } = this.binding;
        await this.channel.assertExchange(exchange, "topic", { durable: true });
        await this.channel.assertQueue(queue, { durable: true });
        for (const routingKey of routingKeys) {
            await this.channel.bindQueue(queue, exchange, routingKey);
        }
        await this.channel.prefetch(10);
        await this.channel.consume(queue, (message) => {
            if (!message)
                return;
            void this.handleMessage(message);
        });
        logger.info({ queue }, "RabbitMQ consumer started");
    }
    private async handleMessage(message: ConsumeMessage): Promise<void> {
        const routingKey = message.fields.routingKey;
        const messageId = message.properties.messageId ?? randomUUID();
        try {
            if (message.properties.messageId && (await this.processedEvents.wasProcessed(messageId))) {
                this.channel.ack(message);
                return;
            }
            const payload = JSON.parse(message.content.toString());
            await this.handle(routingKey, payload);
            await this.processedEvents.markProcessed(messageId, routingKey);
            this.channel.ack(message);
        }
        catch (error) {
            const permanent = isPermanentFailure(error);
            logger.error({ err: error, routingKey, permanent }, "Failed to process RabbitMQ message");
            this.channel.nack(message, false, !permanent);
        }
    }
}
export class MalformedEventError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MalformedEventError";
    }
}
function isPermanentFailure(error: unknown): boolean {
    return (error instanceof SyntaxError ||
        error instanceof NotFoundError ||
        error instanceof InvalidTransitionError ||
        error instanceof MalformedEventError);
}
