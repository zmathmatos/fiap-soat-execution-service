import { StoredOutboxEvent } from "../events/OutboxEvent";

export interface IOutboxRepository {
    findUnpublished(): Promise<StoredOutboxEvent[]>;
    markPublished(id: string): Promise<void>;
}
