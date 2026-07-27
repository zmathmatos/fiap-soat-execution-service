import { DataSource, IsNull, Repository } from "typeorm";
import { IOutboxRepository } from "../../../../domain/repositories/IOutboxRepository";
import { StoredOutboxEvent } from "../../../../domain/events/OutboxEvent";
import { OutboxEventEntity } from "../entities/OutboxEventEntity";

export class TypeORMOutboxRepository implements IOutboxRepository {
    private readonly repo: Repository<OutboxEventEntity>;

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository(OutboxEventEntity);
    }

    async findUnpublished(): Promise<StoredOutboxEvent[]> {
        const entities = await this.repo.find({
            where: { publishedAt: IsNull() },
            order: { createdAt: "ASC" },
            take: 10,
        });
        return entities.map((e) => ({
            id: e.id,
            type: e.eventType,
            payload: e.payload,
            createdAt: e.createdAt,
        }));
    }

    async markPublished(id: string): Promise<void> {
        await this.repo.update(id, { publishedAt: new Date() });
    }
}
