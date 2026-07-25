import { MigrationInterface, QueryRunner } from "typeorm";
export class InitialSchema1753142400000 implements MigrationInterface {
    name = "InitialSchema1753142400000";
    public async up(queryRunner: QueryRunner): Promise<void> {
        const schema = (queryRunner.connection.options as {
            schema?: string;
        }).schema ?? "execution";
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."execution_orders" (
        "id" uuid PRIMARY KEY,
        "service_order_id" uuid NOT NULL UNIQUE,
        "service_order_number" int NOT NULL,
        "status" varchar(32) NOT NULL,
        "diagnosis" jsonb,
        "queue_seq" bigint,
        "enqueued_at" timestamptz,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "failed_at" timestamptz,
        "failure_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_execution_orders_status_seq"
      ON "${schema}"."execution_orders" ("status", "queue_seq")
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."processed_events" (
        "message_id" varchar(255) PRIMARY KEY,
        "routing_key" varchar(128) NOT NULL,
        "processed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "${schema}"."queue_seq"`);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        const schema = (queryRunner.connection.options as {
            schema?: string;
        }).schema ?? "execution";
        await queryRunner.query(`DROP SEQUENCE IF EXISTS "${schema}"."queue_seq"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."processed_events"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."execution_orders"`);
    }
}
