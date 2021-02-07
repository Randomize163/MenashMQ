import client, { Channel, Message, Connection, amqp, assert, ConsumerMessage, Exchange, trycatch, stringify, tryOnce } from './internal';

export class Queue {
    channel: Channel;
    consumerOptions?: amqp.Options.Consume;
    consumerTag: string | null = null;
    consumerOnMessage: ConsumeFunction;

    queueAsserted = false;

    constructor(connection: Connection, public name: string, public options: QueueOptions = {}) {
        this.channel = new Channel(connection);
    }

    public getNativeChannel() {
        return this.channel.getNativeChannel();
    }

    async initialize() {
        if (this.isInitialized()) {
            await this.close();
        }

        await this.channel.initialize();

        try {
            await this.getNativeChannel().assertQueue(this.name, this.options);

            if (this.options.prefetch) {
                await this.channel.prefetch(this.options.prefetch);
            }

            if (this.consumerTag) {
                await this.activateConsumerHelper(this.consumerOnMessage, this.consumerOptions);
            }
        } catch (err) {
            await this.channel.close();
            throw err;
        }

        this.queueAsserted = true;
    }

    async close() {
        if (!this.isInitialized()) {
            return;
        }

        await this.channel.close();
    }

    isInitialized() {
        return this.channel.isInitialized() && this.queueAsserted;
    }

    async prefetch(count: number) {
        await client.waitForInitialize();

        if (!this.isInitialized()) {
            throw new Error(`Queue is not initialized`);
        }

        await tryOnce(() => this.channel.prefetch(count), 'queue');

        this.options.prefetch = count;
    }

    delete(options: amqp.Options.DeleteQueue = {}) {
        return client.deleteQueue(this.name, options);
    }

    async bind(source: Exchange | string, pattern: string = '', args?: any) {
        await client.waitForInitialize();

        if (!this.isInitialized()) {
            throw new Error('Queue is not initialized');
        }

        await client.bind(source, this, pattern, args);
    }

    send(content: Buffer | String | Object, properties: QueueSendProperties = {}) {
        const message = new Message(content, properties);
        return this.sendMessage(message);
    }

    async sendMessage(message: Message) {
        await client.waitForInitialize();

        assert(this.channel);

        await tryOnce(() => Queue.sendHelper(this.getNativeChannel(), this.name, message.getRawContent(), message.properties), 'queue');
    }

    private static sendHelper(channel: amqp.ConfirmChannel, queue: string, content: Buffer, properties?: QueueSendProperties) {
        return new Promise((resolve, reject) => {
            channel.sendToQueue(queue, content, properties, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async activateConsumer(onMessage: ConsumeFunction, options?: amqp.Options.Consume) {
        await client.waitForInitialize();

        if (!this.isInitialized()) {
            throw new Error(`Queue is not initialized`);
        }

        if (this.consumerTag !== null) {
            throw new Error(`Only one consumer could be activated for queue ${this.name}`);
        }

        await this.activateConsumerHelper(onMessage, options);
    }

    private async activateConsumerHelper(onMessage: ConsumeFunction, options: amqp.Options.Consume = { noAck: false }) {
        const consume = async (msg: amqp.Message | null) => {
            if (!msg) {
                return;
            }

            await client.waitForInitialize();

            assert(this.consumerOptions, '[BUG] Consumer options were not defined');

            const message = ConsumerMessage.from(msg, this);

            const { err } = await trycatch(() => onMessage(message));
            if (err) {
                client.reportError(
                    'consumer',
                    new Error(`[BUG] Consumer function of queue ${this.name} throws exception. Message will be rejected. Error: ${stringify(err)}`),
                );
                if (this.consumerOptions.noAck === false && !message.isProcessed()) {
                    message.nack(false);
                }
                return;
            }

            if (this.consumerOptions.noAck === false && !message.isProcessed()) {
                client.reportError('consumer', new Error(`[BUG] Consumer function of queue ${this.name} should ack, nack or reject message.`));
                message.nack(false);
            }
        };

        const { consumerTag } = await this.getNativeChannel().consume(this.name, consume, options);

        this.consumerTag = consumerTag;
        this.consumerOptions = options;
        this.consumerOnMessage = onMessage;
    }

    async stopConsumer() {
        await client.waitForInitialize();

        if (this.consumerTag === null) {
            throw new Error(`Consumer was not activated for queue ${this.name}`);
        }

        await this.getNativeChannel().cancel(this.consumerTag);
        this.consumerTag = null;
    }
}

export interface QueueSendProperties {
    contentType?: any;
    contentEncoding?: any;
    headers?: amqp.MessagePropertyHeaders;
    deliveryMode?: any;
    priority?: any;
    correlationId?: any;
    replyTo?: any;
    expiration?: any;
    messageId?: any;
    timestamp?: any;
    type?: any;
    userId?: any;
    appId?: any;
    clusterId?: any;
}

export interface QueueOptions extends amqp.Options.AssertQueue {
    prefetch?: number;
}

export type ConsumeFunction = (message: ConsumerMessage) => any;
