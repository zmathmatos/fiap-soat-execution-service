import { Column, Entity, PrimaryColumn } from "typeorm";
import { DiagnosisPart, DiagnosisService } from "../../../../domain/value-objects/Diagnosis";
@Entity({ name: "execution_orders" })
export class ExecutionOrderEntity {
    @PrimaryColumn("uuid")
    id!: string;
    @Column({ name: "service_order_id", type: "uuid", unique: true })
    serviceOrderId!: string;
    @Column({ name: "service_order_number", type: "int" })
    serviceOrderNumber!: number;
    @Column({ type: "varchar", length: 32 })
    status!: string;
    @Column({ type: "jsonb", nullable: true })
    diagnosis!: {
        parts: DiagnosisPart[];
        services: DiagnosisService[];
    } | null;
    @Column({ name: "queue_seq", type: "bigint", nullable: true })
    queueSeq!: string | null;
    @Column({ name: "enqueued_at", type: "timestamptz", nullable: true })
    enqueuedAt!: Date | null;
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null;
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null;
    @Column({ name: "failed_at", type: "timestamptz", nullable: true })
    failedAt!: Date | null;
    @Column({ name: "failure_reason", type: "text", nullable: true })
    failureReason!: string | null;
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}
