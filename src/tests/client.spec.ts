import rabbit, { ConsumerMessage, ConsumeFunction } from '../lib/internal';

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    },
};

describe('Client tests', () => {
    describe('Connect tests', () => {
        it('should connect', async () => {
            await rabbit.connect(testConfig.rabbit.uri);
            await rabbit.close();
        });

        it('should not connect twice', async () => {
            await rabbit.connect(testConfig.rabbit.uri);
            await expect(rabbit.connect(testConfig.rabbit.uri)).rejects.toThrow();
            await rabbit.close();
        });
    });

    describe('Report error handling tests', () => {
        it('should handle reportError', async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            for (let i = 0; i < 50; i++) {
                rabbit.reportError('channel', new Error('Test simulated error'));
                await expect(rabbit.waitForInitialize()).resolves.toBeUndefined();
                expect(rabbit.isReady).toBeTruthy();
            }

            await rabbit.close();
        });

        it('should handle reportError during consume', async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            await rabbit.declareTopology({
                exchanges: [{ name: 'ex1', type: 'fanout' }],
                queues: [
                    { name: 'q1', options: { prefetch: 1 } },
                    { name: 'q2', options: { prefetch: 1 } },
                ],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
            });

            await rabbit.queues.q2.activateConsumer((message: ConsumerMessage) => {
                message.ack();
            });

            for (let i = 0; i < 5; i++) {
                rabbit.reportError('channel', new Error('Test simulated error'));
                await expect(rabbit.waitForInitialize()).resolves.toBeUndefined();
                expect(rabbit.isReady).toBeTruthy();
            }

            await rabbit.close();
        });

        it('should not connect twice', async () => {
            await rabbit.connect(testConfig.rabbit.uri);
            await expect(rabbit.connect(testConfig.rabbit.uri)).rejects.toThrow();
            await rabbit.close();
        });
    });

    describe('declareTopology() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await rabbit.close();
        });

        it('should declare topology', async () => {
            await rabbit.declareTopology({
                exchanges: [{ name: 'ex1', type: 'fanout' }],
                queues: [{ name: 'q1' }, { name: 'q2' }],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
            });

            expect(rabbit.queue('q1')).toBeDefined();
            expect(rabbit.queue('q2')).toBeDefined();
            expect(rabbit.exchange('ex1')).toBeDefined();
        });

        const consume: ConsumeFunction = (_msg: ConsumerMessage) => {};

        it('should declare topology with consumers', async () => {
            await rabbit.declareTopology({
                exchanges: [{ name: 'ex1', type: 'fanout' }],
                queues: [{ name: 'q1' }, { name: 'q2' }],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
                consumers: [
                    { queueName: 'q1', onMessage: consume, options: { noAck: true } },
                    { queueName: 'q2', onMessage: consume, options: { noAck: true } },
                ],
            });
        });

        it('should fail to declare topology with consumer of non existing queue', async () => {
            const promise = rabbit.declareTopology({
                exchanges: [{ name: 'ex1', type: 'fanout' }],
                queues: [{ name: 'q1' }, { name: 'q2' }],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
                consumers: [
                    { queueName: 'q-wrong', onMessage: consume, options: { noAck: true } },
                    { queueName: 'q2', onMessage: consume, options: { noAck: true } },
                ],
            });

            await expect(promise).rejects.toThrow();
        });
    });

    describe('declareQueue() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await rabbit.close();
        });

        it('should declare queue', async () => {
            await rabbit.declareQueue('testQueue');
            await rabbit.deleteQueue('testQueue');
        });

        it('should fail to declare queue', async () => {
            // @ts-ignore: error TS2554: Expected 1-2 arguments, but got 0.
            await expect(rabbit.declareQueue()).rejects.toThrow();
        });
    });

    describe('declareExchange() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await rabbit.close();
        });

        it('should declare exchange', async () => {
            await rabbit.declareExchange('testExchange', 'fanout');
            await rabbit.deleteExchange('testExchange');
        });

        it('should fail to declare exchange without a name', async () => {
            // @ts-ignore: error TS2554: Expected 2-3 arguments, but got 0.
            await expect(rabbit.declareExchange()).rejects.toThrow();
        });

        it('should fail to declare exchange without a type', async () => {
            // @ts-ignore: error TS2554: Expected 2-3 arguments, but got 0.
            await expect(rabbit.declareExchange('testExchange')).rejects.toThrow();
        });
    });

    describe('send() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            await rabbit.declareTopology({
                exchanges: [{ name: 'ex1', type: 'fanout' }],
                queues: [{ name: 'q1' }, { name: 'q2' }],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
            });
        });

        afterEach(async () => {
            await rabbit.close();
        });

        it('should send', async () => {
            await rabbit.send('q1', 'Test message');
            await rabbit.send('q2', 'Test message');
            await rabbit.send('ex1', 'Test message');
            await rabbit.send('ex1', 'Test message', { persistent: false }, '*');
        });

        it('should failed to send', async () => {
            await expect(rabbit.send('q0', 'Test message')).rejects.toThrow();
            await expect(rabbit.send('ex0', 'Test message')).rejects.toThrow();
            await expect(rabbit.send('q1', 'Test message', {}, '123')).rejects.toThrow();
            await expect(rabbit.send('q2', 'Test message')).resolves.toBeUndefined();
            await expect(rabbit.send('ex1', 'Test message')).resolves.toBeUndefined();
        });
    });

    describe('queue() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await rabbit.close();
        });

        it('should return a queue by name', async () => {
            expect(() => rabbit.queue('test1')).toThrow();

            await rabbit.declareQueue('test1');
            expect(rabbit.queue('test1').name).toEqual('test1');

            await rabbit.declareQueue('test2');
            expect(rabbit.queue('test2').name).toEqual('test2');

            await rabbit.queue('test1').delete();
            await rabbit.queue('test2').delete();

            expect(() => rabbit.queue('test1')).toThrow();
            expect(() => rabbit.queue('test2')).toThrow();
        });

        it('should throw an error if queue was not declared or was deleted', async () => {
            expect(() => rabbit.queue('some-not-declared-queue-name')).toThrow();

            await rabbit.declareQueue('test1');
            expect(rabbit.queue('test1').name).toEqual('test1');

            await rabbit.queue('test1').delete();
            expect(() => rabbit.queue('test1')).toThrow();
        });
    });

    describe('exchange() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);
        });

        afterEach(async () => {
            await rabbit.close();
        });

        it('should return an exchange by name', async () => {
            expect(() => rabbit.exchange('test1')).toThrow();

            await rabbit.declareExchange('test1', 'fanout');
            expect(rabbit.exchange('test1').name).toEqual('test1');

            await rabbit.declareExchange('test2', 'direct');
            expect(rabbit.exchange('test2').name).toEqual('test2');

            await rabbit.exchange('test1').delete();
            await rabbit.exchange('test2').delete();

            expect(() => rabbit.exchange('test1')).toThrow();
            expect(() => rabbit.exchange('test2')).toThrow();
        });

        it('should throw an error if exchange was not declared or was deleted', async () => {
            expect(() => rabbit.exchange('some-not-declared-queue-name')).toThrow();

            await rabbit.declareExchange('test1', 'fanout');
            expect(rabbit.exchange('test1').name).toEqual('test1');

            await rabbit.exchange('test1').delete();
            expect(() => rabbit.exchange('test1')).toThrow();
        });
    });
});
