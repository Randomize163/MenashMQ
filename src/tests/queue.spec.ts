import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { assert } from 'chai';
import 'mocha';
import client, { Queue, Connection, ConsumerMessage } from '../lib/internal';
import { Event } from '../utils/sync';

chai.use(chaiAsPromised);

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    }
}

// const contentObject = {
//     first: 'value',
//     second: 2,
//     third: [ 1, 2, 3 ],
//     b: false,
//     rec: {
//         first: 'value',
//         second: 2,
//         third: [ 1, 2, 3 ],
//         b: false,
//     },
// };

// const contentString = 'Test content for getContent()';

describe('Queue tests', () => {

    beforeEach(async () => {
        await client.connect(testConfig.rabbit.uri);
    });

    afterEach(async () => {
        await client.close();
    });

    describe('Initialization tests', () => {
        const connection = new Connection(testConfig.rabbit.uri);

        beforeEach(async () => {
            await connection.initialize();
            assert(connection.isConnected());
        });

        afterEach(async () => {
            await connection.close();
            assert(!connection.isConnected());
        });

        it('should initialize() and close()', async () => {
            const queue = new Queue(connection, 'testQ', { durable: false, autoDelete: true });
            await queue.initialize();
            assert(queue.isInitialized());

            await queue.close();
            assert(!queue.isInitialized());
        });

        it('should self close during initialize() ', () => async () => {
            const queue = new Queue(connection, 'testQ', { durable: false, autoDelete: true });

            for (let i = 0; i < 15; i++) {
                await queue.initialize();
                assert(queue.isInitialized());
            }

            await queue.close();
            assert(!queue.isInitialized());
        });
    });

    describe('Declare queue tests', () => {

        it('should declare queue', async () => {
            const testQueueName = 'testQ';

            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
            assert(queue.isInitialized());

            assert(client.queues[testQueueName] === queue);
        });

        it('should declare many queues', async () => {
            for (let i = 0; i < 50; i++) {
                const testQueueName = `testQ${i}`;

                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
                assert(queue.isInitialized());

                assert(client.queues[testQueueName] === queue);
            }
        });

    });

    describe('Delete queue tests', () => {

        it('should declare and delete queue', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
            assert(queue.isInitialized());

            await queue.delete();
            assert(!client.queues[testQueueName]);
        });

        it('should declare and delete many queues', async () => {
            for (let i = 0; i < 50; i++) {
                const testQueueName = `testQ${i}`;
                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
                assert(client.queues[testQueueName]);
                assert(queue.isInitialized());

                await queue.delete();
                assert(!queue.isInitialized());
                assert(!client.queues[testQueueName]);
            }
        });

    });

    describe('Prefetch queue tests', () => {

        it('should set prefetch', async () => {
            for (let i = 0; i < 50; i++) {
                const testQueueName = `testQ${i}`;

                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
                assert(client.queues[testQueueName]);
                assert(queue.isInitialized());

                for (let j = 1; j < 5; j++) {
                    await queue.prefetch(j);
                    assert(queue.options.prefetch === j);
                }

                await queue.delete();
                assert(!queue.isInitialized());
                assert(!client.queues[testQueueName]);
            }
        });

    });

    describe('Send queue tests', () => {

        it('should send to queue', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
            assert(client.queues[testQueueName]);
            assert(queue.isInitialized());

            const message = 'Test send queue';

            for (let i = 0; i < 5000; i++) {
                await queue.send(message);
            }

            await queue.delete();
            assert(!queue.isInitialized());
            assert(!client.queues[testQueueName]);
        }).timeout(10000);

    });

    describe('Consume tests', () => {

        it('should activate consumer', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

            await queue.activateConsumer((_message) => {}, { noAck: true });

            await queue.delete();
            assert(!queue.isInitialized());
            assert(!client.queues[testQueueName]);
        });

        it('should activate and deactivate consumer', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

            await queue.activateConsumer((_message) => {}, { noAck: true });
            await queue.stopConsumer();

            await queue.delete();
            assert(!queue.isInitialized());
            assert(!client.queues[testQueueName]);
        });

        it('should consume message', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

            const content = "Test message";

            const sendFinished = new Event();

            await queue.activateConsumer((message: ConsumerMessage) => {
                assert(message.getContent() === content);
                sendFinished.signal();
            }, { noAck: true });

            await queue.send(content);

            await sendFinished.wait();

            await queue.delete();
            assert(!queue.isInitialized());
            assert(!client.queues[testQueueName]);
        });

    });

});
