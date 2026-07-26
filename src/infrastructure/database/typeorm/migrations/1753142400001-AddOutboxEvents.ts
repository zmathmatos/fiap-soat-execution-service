import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxEvents1753142400001 implements MigrationInterface {
    name = "AddOutboxEvents1753142400001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const schema = (queryRunner.connection.options as { schema?: string }).schema ?? "execution";
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "${schema}"."outbox_events" (
                "id" uuid PRIMARY KEY,
                "event_type" varchar(128) NOT NULL,
                "payload" jsonb NOT NULL,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "published_at" timestamptz NULL
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_outbox_events_published_at"
            ON "${schema}"."outbox_events" ("published_at")
            WHERE "published_at" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const schema = (queryRunner.connection.options as { schema?: string }).schema ?? "execution";
        await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."outbox_events"`);
    }
}
