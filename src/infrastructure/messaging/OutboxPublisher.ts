import { IOutboxRepository } from "../../domain/repositories/IOutboxRepository";
import { StoredOutboxEvent } from "../../domain/events/OutboxEvent";
import { IEventPublisher } from "../../application/ports/IEventPublisher";
import { DiagnosticFinishedEvent, ExecutionFailedEvent, ExecutionFinishedEvent } from "../../domain/events/IntegrationEvents";
import { logger } from "../logger";

const POLL_INTERVAL_MS = 5000;

export class OutboxPublisher {
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly outboxRepository: IOutboxRepository,
        private readonly eventPublisher: IEventPublisher,
    ) {}

    start(): void {
        this.scheduleNext();
        logger.info("[OutboxPublisher] started");
    }

    stop(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private scheduleNext(): void {
        this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
    }

    private async poll(): Promise<void> {
        try {
            const events = await this.outboxRepository.findUnpublished();
            for (const event of events) {
                await this.publishAndMark(event);
            }
        } catch (error) {
            logger.error({ err: error }, "[OutboxPublisher] poll failed");
        } finally {
            this.scheduleNext();
        }
    }

    private async publishAndMark(event: StoredOutboxEvent): Promise<void> {
        try {
            await this.dispatch(event);
            await this.outboxRepository.markPublished(event.id);
        } catch (error) {
            logger.error(
                { err: error, eventType: event.type, eventId: event.id },
                "[OutboxPublisher] failed to publish event, will retry next poll",
            );
        }
    }

    private async dispatch(event: StoredOutboxEvent): Promise<void> {
        switch (event.type) {
            case "diagnostic.finished":
                await this.eventPublisher.publishDiagnosticFinished(event.payload as unknown as DiagnosticFinishedEvent);
                break;
            case "execution.finished":
                await this.eventPublisher.publishExecutionFinished(event.payload as unknown as ExecutionFinishedEvent);
                break;
            case "execution.failed":
                await this.eventPublisher.publishExecutionFailed(event.payload as unknown as ExecutionFailedEvent);
                break;
            default:
                logger.warn(
                    { eventType: event.type, eventId: event.id },
                    "[OutboxPublisher] unknown event type, skipping",
                );
        }
    }
}
