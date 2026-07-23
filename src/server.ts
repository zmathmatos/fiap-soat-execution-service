import "reflect-metadata";
import { buildApp } from "./app";
import { env } from "./infrastructure/config/env";
import { logger } from "./infrastructure/logger";
import { AppDataSource } from "./infrastructure/database/typeorm/data-source";
import { TypeORMExecutionOrderRepository } from "./infrastructure/database/typeorm/repositories/TypeORMExecutionOrderRepository";
import { TypeORMProcessedEventRepository } from "./infrastructure/database/typeorm/repositories/TypeORMProcessedEventRepository";
import { RabbitMQConnection } from "./infrastructure/messaging/RabbitMQConnection";
import { RabbitMQEventPublisher } from "./infrastructure/messaging/RabbitMQEventPublisher";
import { ServiceOrderEventsConsumer } from "./infrastructure/messaging/ServiceOrderEventsConsumer";
import { PaymentEventsConsumer } from "./infrastructure/messaging/PaymentEventsConsumer";
import { EnqueueForDiagnosis } from "./application/use-cases/EnqueueForDiagnosis";
import { RegisterDiagnosis } from "./application/use-cases/RegisterDiagnosis";
import { EnqueueForExecution } from "./application/use-cases/EnqueueForExecution";
import { CancelExecution } from "./application/use-cases/CancelExecution";
import { StartExecution } from "./application/use-cases/StartExecution";
import { FinishExecution } from "./application/use-cases/FinishExecution";
import { FailExecution } from "./application/use-cases/FailExecution";
import { GetQueue } from "./application/use-cases/GetQueue";
import { GetExecutionOrder } from "./application/use-cases/GetExecutionOrder";
async function main(): Promise<void> {
    const dataSource = await AppDataSource.initialize();
    await dataSource.runMigrations();
    logger.info("Database connected, migrations applied");
    const orderRepository = new TypeORMExecutionOrderRepository(dataSource);
    const processedEvents = new TypeORMProcessedEventRepository(dataSource);
    const rabbit = new RabbitMQConnection();
    void (async () => {
        const channel = await rabbit.connectWithRetry();
        await new ServiceOrderEventsConsumer(channel, processedEvents, new EnqueueForDiagnosis(orderRepository), new RegisterDiagnosis(orderRepository)).start();
        await new PaymentEventsConsumer(channel, processedEvents, new EnqueueForExecution(orderRepository), new CancelExecution(orderRepository)).start();
    })();
    const lazyPublisher = {
        async publishExecutionFinished(event: Parameters<RabbitMQEventPublisher["publishExecutionFinished"]>[0]) {
            const channel = await rabbit.connectWithRetry();
            await new RabbitMQEventPublisher(channel).publishExecutionFinished(event);
        },
        async publishExecutionFailed(event: Parameters<RabbitMQEventPublisher["publishExecutionFailed"]>[0]) {
            const channel = await rabbit.connectWithRetry();
            await new RabbitMQEventPublisher(channel).publishExecutionFailed(event);
        }
    };
    const app = buildApp({
        startExecution: new StartExecution(orderRepository),
        finishExecution: new FinishExecution(orderRepository, lazyPublisher),
        failExecution: new FailExecution(orderRepository, lazyPublisher),
        getQueue: new GetQueue(orderRepository),
        getExecutionOrder: new GetExecutionOrder(orderRepository),
        health: async () => ({
            database: dataSource.isInitialized,
            rabbitmq: rabbit.isConnected()
        })
    });
    app.listen(env.port, () => {
        logger.info(`execution-service listening on port ${env.port}`);
    });
}
main().catch((error) => {
    logger.error({ err: error }, "Fatal startup error");
    process.exit(1);
});
