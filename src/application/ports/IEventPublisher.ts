import { DiagnosticFinishedEvent, ExecutionFailedEvent, ExecutionFinishedEvent } from "../../domain/events/IntegrationEvents";
export interface IEventPublisher {
    publishDiagnosticFinished(event: DiagnosticFinishedEvent): Promise<void>;
    publishExecutionFinished(event: ExecutionFinishedEvent): Promise<void>;
    publishExecutionFailed(event: ExecutionFailedEvent): Promise<void>;
}
