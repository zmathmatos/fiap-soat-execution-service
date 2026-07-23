import { IEventPublisher } from "../../src/application/ports/IEventPublisher";
import { ExecutionFailedEvent, ExecutionFinishedEvent } from "../../src/domain/events/IntegrationEvents";
export class FakeEventPublisher implements IEventPublisher {
    public readonly finished: ExecutionFinishedEvent[] = [];
    public readonly failed: ExecutionFailedEvent[] = [];
    async publishExecutionFinished(event: ExecutionFinishedEvent): Promise<void> {
        this.finished.push(event);
    }
    async publishExecutionFailed(event: ExecutionFailedEvent): Promise<void> {
        this.failed.push(event);
    }
}
