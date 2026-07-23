import { Channel } from "amqplib";
import { IProcessedEventRepository } from "../../domain/repositories/IProcessedEventRepository";
import { EnqueueForDiagnosis } from "../../application/use-cases/EnqueueForDiagnosis";
import { RegisterDiagnosis } from "../../application/use-cases/RegisterDiagnosis";
import { DiagnosticFinishedEvent, OrderReceivedEvent } from "../../domain/events/IntegrationEvents";
import { env } from "../config/env";
import { EventConsumer, MalformedEventError } from "./EventConsumer";
export class ServiceOrderEventsConsumer extends EventConsumer {
    constructor(channel: Channel, processedEvents: IProcessedEventRepository, private readonly enqueueForDiagnosis: EnqueueForDiagnosis, private readonly registerDiagnosis: RegisterDiagnosis) {
        super(channel, processedEvents, {
            exchange: env.rabbitmq.serviceOrderExchange,
            queue: env.rabbitmq.serviceOrderQueue,
            routingKeys: ["order.received", "diagnostic.finished"]
        });
    }
    protected async handle(routingKey: string, payload: unknown): Promise<void> {
        const event = payload as Partial<OrderReceivedEvent & DiagnosticFinishedEvent>;
        if (!event.serviceOrderId) {
            throw new MalformedEventError(`Missing serviceOrderId in ${routingKey} event`);
        }
        switch (routingKey) {
            case "order.received":
                await this.enqueueForDiagnosis.execute({
                    serviceOrderId: event.serviceOrderId,
                    serviceOrderNumber: event.serviceOrderNumber ?? 0
                });
                break;
            case "diagnostic.finished":
                await this.registerDiagnosis.execute({
                    serviceOrderId: event.serviceOrderId,
                    parts: event.parts ?? [],
                    services: event.services ?? []
                });
                break;
            default:
                throw new MalformedEventError(`Unknown routing key "${routingKey}"`);
        }
    }
}
