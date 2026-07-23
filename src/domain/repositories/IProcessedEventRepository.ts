export interface IProcessedEventRepository {
    wasProcessed(messageId: string): Promise<boolean>;
    markProcessed(messageId: string, routingKey: string): Promise<void>;
}
