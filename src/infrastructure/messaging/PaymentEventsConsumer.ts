import { Channel } from "amqplib";
import { IProcessedEventRepository } from "../../domain/repositories/IProcessedEventRepository";
import { EnqueueForExecution } from "../../application/use-cases/EnqueueForExecution";
import { CancelExecution } from "../../application/use-cases/CancelExecution";
import { PaymentEvent } from "../../domain/events/IntegrationEvents";
import { env } from "../config/env";
import { EventConsumer, MalformedEventError } from "./EventConsumer";
export class PaymentEventsConsumer extends EventConsumer {
    constructor(channel: Channel, processedEvents: IProcessedEventRepository, private readonly enqueueForExecution: EnqueueForExecution, private readonly cancelExecution: CancelExecution) {
        super(channel, processedEvents, {
            exchange: env.rabbitmq.paymentExchange,
            queue: env.rabbitmq.paymentQueue,
            routingKeys: ["payment.approved", "payment.failed"]
        });
    }
    protected async handle(routingKey: string, payload: unknown): Promise<void> {
        const event = payload as Partial<PaymentEvent>;
        if (!event.serviceOrderId) {
            throw new MalformedEventError(`Missing serviceOrderId in ${routingKey} event`);
        }
        switch (routingKey) {
            case "payment.approved":
                await this.enqueueForExecution.execute({ serviceOrderId: event.serviceOrderId });
                break;
            case "payment.failed":
                await this.cancelExecution.execute({ serviceOrderId: event.serviceOrderId });
                break;
            default:
                throw new MalformedEventError(`Unknown routing key "${routingKey}"`);
        }
    }
}
