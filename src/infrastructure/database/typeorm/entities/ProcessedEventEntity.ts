import { Column, Entity, PrimaryColumn } from "typeorm";
@Entity({ name: "processed_events" })
export class ProcessedEventEntity {
    @PrimaryColumn({ name: "message_id", type: "varchar", length: 255 })
    messageId!: string;
    @Column({ name: "routing_key", type: "varchar", length: 128 })
    routingKey!: string;
    @Column({ name: "processed_at", type: "timestamptz" })
    processedAt!: Date;
}
