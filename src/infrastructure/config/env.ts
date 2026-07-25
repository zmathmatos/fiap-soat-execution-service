import "dotenv/config";
export const env = {
    port: Number(process.env.PORT ?? 3002),
    db: {
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER ?? "postgres",
        password: process.env.DB_PASSWORD ?? "postgres",
        name: process.env.DB_NAME ?? "fiap_soat_db",
        schema: process.env.DB_SCHEMA ?? "execution"
    },
    rabbitmq: {
        url: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
        serviceOrderExchange: process.env.RABBITMQ_SERVICE_ORDER_EXCHANGE ?? "service-order-events",
        paymentExchange: process.env.RABBITMQ_PAYMENT_EXCHANGE ?? "payment-events",
        executionExchange: process.env.RABBITMQ_EXECUTION_EXCHANGE ?? "execution-events",
        serviceOrderQueue: process.env.RABBITMQ_SERVICE_ORDER_QUEUE ?? "execution-service.service-order-events",
        paymentQueue: process.env.RABBITMQ_PAYMENT_QUEUE ?? "execution-service.payment-events"
    },
    logLevel: process.env.LOG_LEVEL ?? "info"
};
