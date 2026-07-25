import { IEventPublisher } from "../../src/application/ports/IEventPublisher";
import { DiagnosticFinishedEvent, ExecutionFailedEvent, ExecutionFinishedEvent } from "../../src/domain/events/IntegrationEvents";
export class FakeEventPublisher implements IEventPublisher {
    public readonly diagnosed: DiagnosticFinishedEvent[] = [];
    public readonly finished: ExecutionFinishedEvent[] = [];
    public readonly failed: ExecutionFailedEvent[] = [];
    async publishDiagnosticFinished(event: DiagnosticFinishedEvent): Promise<void> {
        this.diagnosed.push(event);
    }
    async publishExecutionFinished(event: ExecutionFinishedEvent): Promise<void> {
        this.finished.push(event);
    }
    async publishExecutionFailed(event: ExecutionFailedEvent): Promise<void> {
        this.failed.push(event);
    }
}
