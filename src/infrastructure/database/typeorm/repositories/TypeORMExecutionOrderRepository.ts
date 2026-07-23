import { DataSource, Repository } from "typeorm";
import { ExecutionOrder, ExecutionOrderStatus } from "../../../../domain/entities/ExecutionOrder";
import { Diagnosis } from "../../../../domain/value-objects/Diagnosis";
import { IExecutionOrderRepository } from "../../../../domain/repositories/IExecutionOrderRepository";
import { ExecutionOrderEntity } from "../entities/ExecutionOrderEntity";
export class TypeORMExecutionOrderRepository implements IExecutionOrderRepository {
    private readonly repo: Repository<ExecutionOrderEntity>;
    constructor(private readonly dataSource: DataSource) {
        this.repo = dataSource.getRepository(ExecutionOrderEntity);
    }
    async save(order: ExecutionOrder): Promise<void> {
        await this.repo.save(toEntity(order));
    }
    async findByServiceOrderId(serviceOrderId: string): Promise<ExecutionOrder | null> {
        const entity = await this.repo.findOneBy({ serviceOrderId });
        return entity ? toDomain(entity) : null;
    }
    async findQueue(status: ExecutionOrderStatus): Promise<ExecutionOrder[]> {
        const entities = await this.repo.find({
            where: { status },
            order: { queueSeq: "ASC" }
        });
        return entities.map(toDomain);
    }
    async nextQueueSeq(): Promise<number> {
        const schema = (this.dataSource.options as {
            schema?: string;
        }).schema ?? "execution";
        const rows: {
            nextval: string;
        }[] = await this.dataSource.query(`SELECT nextval('"${schema}"."queue_seq"')`);
        return Number(rows[0].nextval);
    }
}
function toEntity(order: ExecutionOrder): ExecutionOrderEntity {
    const state = order.toState();
    const entity = new ExecutionOrderEntity();
    entity.id = state.id;
    entity.serviceOrderId = state.serviceOrderId;
    entity.serviceOrderNumber = state.serviceOrderNumber;
    entity.status = state.status;
    entity.diagnosis = state.diagnosis
        ? { parts: state.diagnosis.parts, services: state.diagnosis.services }
        : null;
    entity.queueSeq = state.queueSeq === null ? null : String(state.queueSeq);
    entity.enqueuedAt = state.enqueuedAt;
    entity.startedAt = state.startedAt;
    entity.finishedAt = state.finishedAt;
    entity.failedAt = state.failedAt;
    entity.failureReason = state.failureReason;
    entity.createdAt = state.createdAt;
    entity.updatedAt = state.updatedAt;
    return entity;
}
function toDomain(entity: ExecutionOrderEntity): ExecutionOrder {
    return ExecutionOrder.restore({
        id: entity.id,
        serviceOrderId: entity.serviceOrderId,
        serviceOrderNumber: entity.serviceOrderNumber,
        status: entity.status as ExecutionOrderStatus,
        diagnosis: entity.diagnosis
            ? new Diagnosis(entity.diagnosis.parts, entity.diagnosis.services)
            : null,
        queueSeq: entity.queueSeq === null ? null : Number(entity.queueSeq),
        enqueuedAt: entity.enqueuedAt,
        startedAt: entity.startedAt,
        finishedAt: entity.finishedAt,
        failedAt: entity.failedAt,
        failureReason: entity.failureReason,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
    });
}
