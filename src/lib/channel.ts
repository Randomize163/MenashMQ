import client, { Connection, amqp, assert, QueueSendProperties } from './internal';

export class Channel {
    channel: amqp.ConfirmChannel | null = null;
    private prefetchCount: number;

    constructor(public connection: Connection) {}

    async initialize() {
        if (this.isInitialized()) {
            await this.close();
        }

        assert(this.connection.isConnected());

        const channel = await this.connection.connection!.createConfirmChannel();

        channel.once('error', (err: Error) => {
            this.channel = null;
            client.reportError('channel', err);
        });

        channel.once('close', () => {
            this.channel = null;
            client.reportError('channel', new Error(`Channel closed`));
        });

        this.channel = channel;
    }

    async close() {
        if (!this.isInitialized()) {
            return;
        }

        const channel = this.getNativeChannel();
        this.channel = null;

        channel.removeAllListeners('error');
        channel.removeAllListeners('close');

        // eslint-disable-next-line no-console
        await channel.close().catch((err) => console.error(`Channel close failed with error:`, err));
    }

    isInitialized() {
        return !!this.channel;
    }

    async prefetch(count: number) {
        assert(this.isInitialized(), `Channel is not initialized`);

        if (this.prefetchCount === count) {
            return;
        }

        await this.getNativeChannel().prefetch(count);

        this.prefetchCount = count;
    }

    sendToQueue(queue: string, content: Buffer, options?: QueueSendProperties) {
        assert(this.isInitialized(), `Channel is not initialized`);

        return new Promise((resolve, reject) => {
            this.getNativeChannel().sendToQueue(queue, content, options, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    getNativeChannel() {
        if (!this.isInitialized()) {
            throw new Error('[BUG] Trying to get native channel, but Channel was closed or was not initialized yet');
        }

        assert(this.channel);
        return this.channel;
    }
}
