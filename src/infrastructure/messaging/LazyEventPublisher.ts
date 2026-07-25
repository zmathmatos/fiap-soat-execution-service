import { IEventPublisher } from "../../application/ports/IEventPublisher";
import { DiagnosticFinishedEvent, ExecutionFailedEvent, ExecutionFinishedEvent } from "../../domain/events/IntegrationEvents";
import { RabbitMQConnection } from "./RabbitMQConnection";
import { RabbitMQEventPublisher } from "./RabbitMQEventPublisher";
// Resolves the channel only when an event is actually published, so the HTTP API
// stays up while RabbitMQ is unreachable.
export class LazyEventPublisher implements IEventPublisher {
    constructor(private readonly connection: RabbitMQConnection) { }
    async publishDiagnosticFinished(event: DiagnosticFinishedEvent): Promise<void> {
        await (await this.publisher()).publishDiagnosticFinished(event);
    }
    async publishExecutionFinished(event: ExecutionFinishedEvent): Promise<void> {
        await (await this.publisher()).publishExecutionFinished(event);
    }
    async publishExecutionFailed(event: ExecutionFailedEvent): Promise<void> {
        await (await this.publisher()).publishExecutionFailed(event);
    }
    private async publisher(): Promise<RabbitMQEventPublisher> {
        return new RabbitMQEventPublisher(await this.connection.connectWithRetry());
    }
}
