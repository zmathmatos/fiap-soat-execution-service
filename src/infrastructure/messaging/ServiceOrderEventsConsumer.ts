import { Channel } from "amqplib";
import { IProcessedEventRepository } from "../../domain/repositories/IProcessedEventRepository";
import { EnqueueForDiagnosis } from "../../application/use-cases/EnqueueForDiagnosis";
import { OrderReceivedEvent } from "../../domain/events/IntegrationEvents";
import { env } from "../config/env";
import { EventConsumer, MalformedEventError } from "./EventConsumer";
export class ServiceOrderEventsConsumer extends EventConsumer {
    constructor(channel: Channel, processedEvents: IProcessedEventRepository, private readonly enqueueForDiagnosis: EnqueueForDiagnosis) {
        super(channel, processedEvents, {
            exchange: env.rabbitmq.serviceOrderExchange,
            queue: env.rabbitmq.serviceOrderQueue,
            routingKeys: ["order.received"]
        });
    }
    protected async handle(routingKey: string, payload: unknown): Promise<void> {
        const event = payload as Partial<OrderReceivedEvent>;
        if (!event.serviceOrderId) {
            throw new MalformedEventError(`Missing serviceOrderId in ${routingKey} event`);
        }
        if (routingKey !== "order.received") {
            throw new MalformedEventError(`Unknown routing key "${routingKey}"`);
        }
        await this.enqueueForDiagnosis.execute({
            serviceOrderId: event.serviceOrderId,
            serviceOrderNumber: event.serviceOrderNumber ?? 0
        });
    }
}
