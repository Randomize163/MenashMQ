import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { assert } from 'chai';
import 'mocha';
import client, { Connection, Exchange, ExchangeType } from '../lib/internal';

chai.use(chaiAsPromised);

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
        assert(connection.isConnected());
    });

    afterEach(async () => {
        await connection.close();
        assert(!connection.isConnected());
    });

    describe('Initialize tests', () => {
        it('should initialize and close exchange', async () => {
            const exchange = new Exchange(connection, 'testEx1', 'direct', { autoDelete: true, durable: false });

            for (let i = 0; i < 50; i++) {
                await exchange.initialize();
                assert(exchange.isInitialized());

                await exchange.close();
                assert(!exchange.isInitialized());
            }
        });

        it('should initialize channel', async () => {
            for (const exchangeType of exchangeTypes) {
                const exchange = new Exchange(connection, `testEx2${exchangeType}`, exchangeType, { autoDelete: true, durable: false });

                for (let i = 0; i < 50; i++) {
                    await exchange.initialize();
                    assert(exchange.isInitialized());
                }

                await exchange.close();
                assert(!exchange.isInitialized());
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
                assert(exchange.isInitialized());

                for (let i = 0; i < 500; i++) {
                    await exchange.send('send test message');
                }

                assert(exchange.isInitialized());
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
                    assert(exchange.isInitialized());

                    await exchange.delete();

                    assert.throws(() => client.exchange(exchangeName));
                }
            }
        });
    });
});
