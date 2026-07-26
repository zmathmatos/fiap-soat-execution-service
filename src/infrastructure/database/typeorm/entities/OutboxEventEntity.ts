import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("outbox_events")
export class OutboxEventEntity {
    @PrimaryColumn("uuid")
    id!: string;

    @Column({ name: "event_type", type: "varchar", length: 128 })
    eventType!: string;

    @Column({ type: "jsonb" })
    payload!: Record<string, unknown>;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "published_at", type: "timestamptz", nullable: true })
    publishedAt!: Date | null;
}
