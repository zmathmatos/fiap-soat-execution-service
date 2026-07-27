import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../../config/env";
import { ExecutionOrderEntity } from "./entities/ExecutionOrderEntity";
import { ProcessedEventEntity } from "./entities/ProcessedEventEntity";
import { OutboxEventEntity } from "./entities/OutboxEventEntity";
import { InitialSchema1753142400000 } from "./migrations/1753142400000-InitialSchema";
import { AddOutboxEvents1753142400001 } from "./migrations/1753142400001-AddOutboxEvents";
export async function initializeDatabase(dataSource: DataSource): Promise<DataSource> {
    if (!dataSource.isInitialized)
        await dataSource.initialize();
    const schema = (dataSource.options as {
        schema?: string;
    }).schema ?? "execution";
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await dataSource.runMigrations();
    return dataSource;
}
export const AppDataSource = new DataSource({
    type: "postgres",
    host: env.db.host,
    port: env.db.port,
    username: env.db.user,
    password: env.db.password,
    database: env.db.name,
    schema: env.db.schema,
    ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
    entities: [ExecutionOrderEntity, ProcessedEventEntity, OutboxEventEntity],
    migrations: [InitialSchema1753142400000, AddOutboxEvents1753142400001],
    migrationsRun: false,
    synchronize: false,
    logging: false
});
