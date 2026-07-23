import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../../config/env";
import { ExecutionOrderEntity } from "./entities/ExecutionOrderEntity";
import { ProcessedEventEntity } from "./entities/ProcessedEventEntity";
import { InitialSchema1753142400000 } from "./migrations/1753142400000-InitialSchema";
export const AppDataSource = new DataSource({
    type: "postgres",
    host: env.db.host,
    port: env.db.port,
    username: env.db.user,
    password: env.db.password,
    database: env.db.name,
    schema: env.db.schema,
    entities: [ExecutionOrderEntity, ProcessedEventEntity],
    migrations: [InitialSchema1753142400000],
    migrationsRun: false,
    synchronize: false,
    logging: false
});
