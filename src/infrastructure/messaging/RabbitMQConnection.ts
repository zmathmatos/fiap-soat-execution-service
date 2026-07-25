import amqplib, { Channel, ChannelModel } from "amqplib";
import { env } from "../config/env";
import { logger } from "../logger";
const RETRY_DELAY_MS = 5000;
export class RabbitMQConnection {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    async connectWithRetry(): Promise<Channel> {
        for (;;) {
            try {
                return await this.connect();
            }
            catch (error) {
                logger.error({ err: error }, `RabbitMQ unavailable, retrying in ${RETRY_DELAY_MS}ms`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }
    }
    async connect(): Promise<Channel> {
        if (this.channel)
            return this.channel;
        this.connection = await amqplib.connect(env.rabbitmq.url);
        this.connection.on("close", () => {
            logger.warn("RabbitMQ connection closed");
            this.connection = null;
            this.channel = null;
        });
        this.channel = await this.connection.createChannel();
        logger.info("RabbitMQ connected");
        return this.channel;
    }
    isConnected(): boolean {
        return this.channel !== null;
    }
    async close(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
        this.channel = null;
        this.connection = null;
    }
}
