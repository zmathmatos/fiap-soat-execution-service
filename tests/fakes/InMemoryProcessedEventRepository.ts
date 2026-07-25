import { IProcessedEventRepository } from "../../src/domain/repositories/IProcessedEventRepository";
export class InMemoryProcessedEventRepository implements IProcessedEventRepository {
    private readonly processed = new Set<string>();
    async wasProcessed(messageId: string): Promise<boolean> {
        return this.processed.has(messageId);
    }
    async markProcessed(messageId: string): Promise<void> {
        this.processed.add(messageId);
    }
}
