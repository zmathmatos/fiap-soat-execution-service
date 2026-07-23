import { ExecutionFailedEvent, ExecutionFinishedEvent } from "../../domain/events/IntegrationEvents";
export interface IEventPublisher {
    publishExecutionFinished(event: ExecutionFinishedEvent): Promise<void>;
    publishExecutionFailed(event: ExecutionFailedEvent): Promise<void>;
}
