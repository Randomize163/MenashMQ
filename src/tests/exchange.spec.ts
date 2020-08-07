import client, { Connection, Exchange, ExchangeType } from '../lib/internal';

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    },
};

const exchangeTypes: ExchangeType[] = ['direct', 'fanout', 'topic', 'headers'];

describe('Exchange tests', () => {
    const connection = new Connection(testConfig.rabbit.uri);

    beforeEach(async () => {
        await connection.initialize();
        expect(connection.isConnected()).toBeTruthy();
    });

    afterEach(async () => {
        await connection.close();
        expect(connection.isConnected()).toBeFalsy();
    });

    describe('Initialize tests', () => {
        it('should initialize and close exchange', async () => {
            const exchange = new Exchange(connection, 'testEx1', 'direct', { autoDelete: true, durable: false });

            for (let i = 0; i < 50; i++) {
                await exchange.initialize();
                expect(exchange.isInitialized()).toBeTruthy();

                await exchange.close();
                expect(exchange.isInitialized()).toBeFalsy();
            }
        });

        it('should initialize channel', async () => {
            for (const exchangeType of exchangeTypes) {
                const exchange = new Exchange(connection, `testEx2${exchangeType}`, exchangeType, { autoDelete: true, durable: false });

                for (let i = 0; i < 50; i++) {
                    await exchange.initialize();
                    expect(exchange.isInitialized()).toBeTruthy();
                }

                await exchange.close();
                expect(exchange.isInitialized()).toBeFalsy();
            }
        });
    });

    describe('Send tests', () => {
        beforeEach(async () => {
            await client.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await client.close();
        });

        it('should send to exchange', async () => {
            for (const exchangeType of exchangeTypes) {
                const exchangeName = `testEx3${exchangeType}`;

                const exchange = await client.declareExchange(exchangeName, exchangeType, { autoDelete: true, durable: false });
                expect(exchange.isInitialized()).toBeTruthy();

                for (let i = 0; i < 500; i++) {
                    await exchange.send('send test message');
                }

                expect(exchange.isInitialized()).toBeTruthy();
            }
        });
    });

    describe('Delete tests', () => {
        beforeEach(async () => {
            await client.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await client.close();
        });

        it('should delete exchange', async () => {
            for (const exchangeType of exchangeTypes) {
                const exchangeName = `testEx4${exchangeType}`;

                for (let i = 0; i < 15; i++) {
                    const exchange = await client.declareExchange(exchangeName, exchangeType, { autoDelete: true, durable: false });
                    expect(exchange.isInitialized()).toBeTruthy();

                    await exchange.delete();

                    expect(() => client.exchange(exchangeName)).toThrow();
                }
            }
        });
    });
});
