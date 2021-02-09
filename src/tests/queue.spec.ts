import client, { Queue, Connection, ConsumerMessage } from '../lib/internal';
import { Event } from '../utils/sync';

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    },
};

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
            expect(connection.isConnected()).toBeTruthy();
        });

        afterEach(async () => {
            await connection.close();
            expect(connection.isConnected()).toBeFalsy();
        });

        it('should initialize() and close()', async () => {
            const queue = new Queue(connection, 'testQ', { durable: false, autoDelete: true });
            await queue.initialize();
            expect(queue.isInitialized()).toBeTruthy();

            await queue.close();
            expect(queue.isInitialized()).toBeFalsy();
        });

        it('should self close during initialize() ', async () => {
            const queue = new Queue(connection, 'testQ', { durable: false, autoDelete: true });

            for (let i = 0; i < 15; i++) {
                await queue.initialize();
                expect(queue.isInitialized()).toBeTruthy();
            }

            await queue.close();
            expect(queue.isInitialized()).toBeFalsy();
        });

        it('should fail to initialize with wrong configuration() ', async () => {
            const queue = new Queue(connection, 'testQ', { durable: false, autoDelete: true, prefetch: -1 });
            await expect(queue.initialize()).rejects.toThrowError();

            expect(queue.isInitialized()).toBeFalsy();
            await queue.close();
        });
    });

    describe('Declare queue tests', () => {
        it('should declare queue', async () => {
            const testQueueName = 'testQ';

            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
            expect(queue.isInitialized()).toBeTruthy();

            expect(client.queue(testQueueName)).toBe(queue);
        });

        it('should declare many queues', async () => {
            for (let i = 0; i < 50; i++) {
                const testQueueName = `testQ${i}`;

                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
                expect(queue.isInitialized()).toBeTruthy();

                expect(client.queue(testQueueName)).toBe(queue);
            }
        });
    });

    describe('Delete queue tests', () => {
        it('should declare and delete queue', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
            expect(queue.isInitialized()).toBeTruthy();

            await queue.delete();
            expect(() => client.queue(testQueueName)).toThrow();
        });

        it('should declare and delete many queues', async () => {
            for (let i = 0; i < 50; i++) {
                const testQueueName = `testQ${i}`;
                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
                expect(client.queue(testQueueName)).toBeTruthy();
                expect(queue.isInitialized()).toBeTruthy();

                await queue.delete();
                expect(queue.isInitialized()).toBeFalsy();
                expect(() => client.queue(testQueueName)).toThrow();
            }
        });
    });

    describe('Prefetch queue tests', () => {
        it('should set prefetch', async () => {
            for (let i = 0; i < 50; i++) {
                const testQueueName = `testQ${i}`;

                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
                expect(client.queue(testQueueName)).toBeTruthy();
                expect(queue.isInitialized()).toBeTruthy();

                for (let j = 1; j < 5; j++) {
                    await queue.prefetch(j);
                    expect(queue.options.prefetch).toEqual(j);
                }

                await queue.delete();
                expect(queue.isInitialized()).toBeFalsy();
                expect(() => client.queue(testQueueName)).toThrow();
            }
        });
    });

    describe('Send queue tests', () => {
        it('should send to queue', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });
            expect(client.queue(testQueueName)).toBe(queue);
            expect(queue.isInitialized()).toBeTruthy();

            const message = 'Test send queue';

            for (let i = 0; i < 500; i++) {
                await queue.send(message);
            }

            await queue.delete();
            expect(queue.isInitialized()).toBeFalsy();
            expect(() => client.queue(testQueueName)).toThrow();
        });
    });

    describe('Consume tests', () => {
        it('should activate consumer', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

            await queue.activateConsumer((_message) => {}, { noAck: true });

            await queue.delete();
            expect(queue.isInitialized()).toBeFalsy();
            expect(() => client.queue(testQueueName)).toThrow();
        });

        it('should activate and deactivate consumer', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

            await queue.activateConsumer((_message) => {}, { noAck: true });
            await queue.stopConsumer();

            await queue.delete();
            expect(queue.isInitialized()).toBeFalsy();
            expect(() => client.queue(testQueueName)).toThrow();
        });

        it('should consume message', async () => {
            const testQueueName = 'testQ';
            const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

            const content = 'Test message';

            const sendFinished = new Event();

            await queue.activateConsumer(
                (message: ConsumerMessage) => {
                    expect(message.getContent()).toBe(content);
                    sendFinished.signal();
                },
                { noAck: true },
            );

            await queue.send(content);

            await sendFinished.wait();

            await queue.delete();
            expect(queue.isInitialized()).toBeFalsy();
            expect(() => client.queue(testQueueName)).toThrow();
        });

        it.each([
            [undefined, false, false],
            [undefined, false, true],
            [undefined, true, false],
            [{ noAck: false }, false, false],
            [{ noAck: false }, false, true],
            [{ noAck: false }, true, false],
            [{ noAck: true }, false, false], // client shouldnt ack if noAck=true
        ])(
            'should handle throwing consumers with consumeOptions %p, and consumer acked %p nacked %p',
            async (consumeOptions: any, didConsumerAcked: boolean, didConsumerNacked: boolean) => {
                const testQueueName = 'testQ';
                const queue = await client.declareQueue(testQueueName, { durable: false, autoDelete: true });

                const content = 'Test message';

                const sendFinished = new Event();

                let wasCalled = false;

                await queue.activateConsumer((message: ConsumerMessage) => {
                    expect(message.getContent()).toBe(content);

                    expect(wasCalled).toBeFalsy();
                    wasCalled = true;

                    sendFinished.signal();
                    if (!consumeOptions.noAck && didConsumerAcked) {
                        message.ack();
                    } else if (!consumeOptions.noAck && didConsumerNacked) {
                        message.nack();
                    }
                    throw new Error('Some user error');
                }, consumeOptions);

                await queue.send(content);

                await sendFinished.wait();

                await queue.delete();
                expect(queue.isInitialized()).toBeFalsy();
                expect(() => client.queue(testQueueName)).toThrow();
            },
        );
    });
});
