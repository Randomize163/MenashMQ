import client, { amqp } from './internal';

export class Connection {
    connection: amqp.Connection | null = null;

    constructor(private url: string | amqp.Options.Connect, private socketOptions?: any) {}

    async initialize() {
        if (this.connection) {
            await this.close();
        }

        this.connection = await amqp.connect(this.url, this.socketOptions);

        this.connection.once('error', (err: Error) => {
            this.connection = null;
            client.reportError('connection', err);
        });

        this.connection.once('close', () => {
            this.connection = null;
            client.reportError('connection', new Error('Connection closed'));
        });
    }

    async close() {
        if (!this.connection) {
            return;
        }

        const { connection } = this;
        this.connection = null;

        connection.removeAllListeners('error');
        connection.removeAllListeners('close');

        await connection.close().catch((err) => {
            // eslint-disable-next-line no-console
            console.log(`Warning: failed to close connection with error`, err);
        });
    }

    isConnected() {
        return !!this.connection;
    }
}
