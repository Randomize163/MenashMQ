import client, { Channel, Message, Connection, amqp, assert, tryOnce } from './internal';

export class Exchange {
    channel: Channel;

    exchangeAsserted = false;

    constructor(connection: Connection, public name: string, public type: ExchangeType, public options: amqp.Options.AssertExchange = {}) {
        this.channel = new Channel(connection);
    }

    async initialize() {
        if (this.isInitialized()) {
            await this.close();
        }

        await this.channel.initialize();

        try {
            await this.getNativeChannel().assertExchange(this.name, this.type, this.options);
        } catch (err) {
            await this.channel.close();
            return;
        }

        this.exchangeAsserted = true;

        assert(this.isInitialized());
    }

    async close() {
        if (!this.isInitialized()) {
            return;
        }

        // eslint-disable-next-line no-console
        await this.channel.close().catch((err) => console.error(`Channel.close() for ${this.name} failed with error:`, err));

        this.exchangeAsserted = false;

        assert(!this.isInitialized());
    }

    getNativeChannel() {
        return this.channel.getNativeChannel();
    }

    isInitialized() {
        return this.channel.isInitialized() && this.exchangeAsserted;
    }

    async send(content: Buffer | String | Object, routingKey: string = '', properties: ExchangeSendProperties = {}) {
        await client.waitForInitialize();

        assert(this.isInitialized());

        const message = new Message(content, properties);

        await tryOnce(
            () => Exchange.publishHelper(this.getNativeChannel(), this.name, routingKey, message.getRawContent(), message.properties),
            'exchange',
        );
    }

    private static publishHelper(
        channel: amqp.ConfirmChannel,
        exchange: string,
        routingKey: string,
        content: Buffer,
        options?: amqp.Options.Publish,
    ) {
        return new Promise((resolve, reject) => {
            channel.publish(exchange, routingKey, content, options, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async delete(ifUnused?: boolean) {
        await client.waitForInitialize();

        if (!this.isInitialized()) {
            throw new Error('Exchange is not initialized');
        }

        await client.deleteExchange(this.name, ifUnused);
    }

    async bind(source: Exchange | string, pattern: string = '', args?: any) {
        await client.waitForInitialize();

        if (!this.isInitialized()) {
            throw new Error('Exchange is not initialized');
        }

        await client.bind(source, this, pattern, args);
    }

    static getTypes(): ExchangeType[] {
        return ['fanout', 'topic', 'direct', 'headers'];
    }

    // addConsumer() {}
    // removeConsumer() {}
}

export interface ExchangeSendProperties extends amqp.Options.Publish {}

export type ExchangeType = 'fanout' | 'topic' | 'direct' | 'headers';
