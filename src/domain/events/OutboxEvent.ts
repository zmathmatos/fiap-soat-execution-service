export interface OutboxEvent {
    type: string;
    payload: Record<string, unknown>;
}

export interface StoredOutboxEvent extends OutboxEvent {
    id: string;
    createdAt: Date;
}
