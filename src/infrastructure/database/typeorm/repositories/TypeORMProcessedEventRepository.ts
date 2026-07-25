import { DataSource, Repository } from "typeorm";
import { IProcessedEventRepository } from "../../../../domain/repositories/IProcessedEventRepository";
import { ProcessedEventEntity } from "../entities/ProcessedEventEntity";
export class TypeORMProcessedEventRepository implements IProcessedEventRepository {
    private readonly repo: Repository<ProcessedEventEntity>;
    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(ProcessedEventEntity);
    }
    async wasProcessed(messageId: string): Promise<boolean> {
        return (await this.repo.countBy({ messageId })) > 0;
    }
    async markProcessed(messageId: string, routingKey: string): Promise<void> {
        await this.repo.save({ messageId, routingKey, processedAt: new Date() });
    }
}
