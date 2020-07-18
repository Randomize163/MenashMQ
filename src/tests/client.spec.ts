import rabbit, { ConsumerMessage } from '../lib/internal';
import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { assert } from 'chai';
import 'mocha';

chai.use(chaiAsPromised);

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    }
}

describe('Client tests', () => {

    describe('Connect tests', () => {

        it('should connect', async () => {
            await rabbit.connect(testConfig.rabbit.uri);
            await rabbit.close();
        });

        it('should not connect twice', async () => {
            await rabbit.connect(testConfig.rabbit.uri);
            assert.isRejected(rabbit.connect(testConfig.rabbit.uri));
            await rabbit.close();
        });

    });

    describe('Report error handling tests', () => {

        it('should handle reportError', async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            for (let i = 0; i < 50; i++) {
                rabbit.reportError('channel', new Error('Test simulated error'));
                await assert.isFulfilled(rabbit.waitForInitialize());
                assert(rabbit.isReady);
            }

            await rabbit.close();
        });

        it('should handle reportError during consume', async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            await rabbit.declareTopology({
                exchanges: [
                    { name: 'ex1', type: 'fanout' },
                ],
                queues: [
                    { name: 'q1', options: { prefetch: 1 } },
                    { name: 'q2', options: { prefetch: 1 } },
                ],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
            });

            await rabbit.queues['q2'].activateConsumer((message: ConsumerMessage) => {
                console.log('q2 received message: ', message.getContent());
                message.ack();
            });

            for (let i = 0; i < 5; i++) {
                rabbit.reportError('channel', new Error('Test simulated error'));
                await assert.isFulfilled(rabbit.waitForInitialize());
                assert(rabbit.isReady);
            }

            await rabbit.close();
        });

        it('should not connect twice', async () => {
            await rabbit.connect(testConfig.rabbit.uri);
            assert.isRejected(rabbit.connect(testConfig.rabbit.uri));
            await rabbit.close();
        });

    });

    describe('declareTopology() tests', () => {

        it('should declare topology', async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            await rabbit.declareTopology({
                exchanges: [
                    { name: 'ex1', type: 'fanout' },
                ],
                queues: [
                    { name: 'q1' },
                    { name: 'q2' },
                ],
                bindings: [
                    { source: 'ex1', destination: 'q1' },
                    { source: 'ex1', destination: 'q2' },
                ],
            });

            await rabbit.close();
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
            await assert.isRejected(rabbit.declareQueue());
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
            await assert.isRejected(rabbit.declareExchange());
        });

        it('should fail to declare exchange without a type', async () => {
            // @ts-ignore: error TS2554: Expected 2-3 arguments, but got 0.
            await assert.isRejected(rabbit.declareExchange('testExchange'));
        });
    });

    describe('send() tests', () => {
        beforeEach(async () => {
            await rabbit.connect(testConfig.rabbit.uri);

            await rabbit.declareTopology({
                exchanges: [
                    { name: 'ex1', type: 'fanout' },
                ],
                queues: [
                    { name: 'q1' },
                    { name: 'q2' },
                ],
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
            await rabbit.send('q1', "Test message");
            await rabbit.send('q2', "Test message");
            await rabbit.send('ex1', "Test message");
            await rabbit.send('ex1', "Test message", { persistent: false }, '*');
        });

        it('should failed to send', async () => {
            assert.isRejected(rabbit.send('q0', "Test message"));
            assert.isRejected(rabbit.send('ex0', "Test message"));
            assert.isRejected(rabbit.send('q1', "Test message", {}, '123'));
            await rabbit.send('q2', "Test message");
            await rabbit.send('ex1', "Test message");
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
            assert.throws(() => rabbit.queue('test1'));

            await rabbit.declareQueue('test1');
            assert.equal(rabbit.queue('test1').name, 'test1');

            await rabbit.declareQueue('test2');
            assert.equal(rabbit.queue('test2').name, 'test2');

            await rabbit.queue('test1').delete();
            await rabbit.queue('test2').delete();

            assert.throws(() => rabbit.queue('test1'));
            assert.throws(() => rabbit.queue('test2'));
        });

        it('should throw an error if queue was not declared or was deleted', async () => {
            assert.throws(() => rabbit.queue('some-not-declared-queue-name'));

            await rabbit.declareQueue('test1');
            assert.equal(rabbit.queue('test1').name, 'test1');

            await rabbit.queue('test1').delete();
            assert.throws(() => rabbit.queue('test1'));
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
            assert.throws(() => rabbit.exchange('test1'));

            await rabbit.declareExchange('test1', 'fanout');
            assert.equal(rabbit.exchange('test1').name, 'test1');

            await rabbit.declareExchange('test2', 'direct');
            assert.equal(rabbit.exchange('test2').name, 'test2');

            await rabbit.exchange('test1').delete();
            await rabbit.exchange('test2').delete();

            assert.throws(() => rabbit.exchange('test1'));
            assert.throws(() => rabbit.exchange('test2'));
        });

        it('should throw an error if exchange was not declared or was deleted', async () => {
            assert.throws(() => rabbit.exchange('some-not-declared-queue-name'));

            await rabbit.declareExchange('test1', 'fanout');
            assert.equal(rabbit.exchange('test1').name, 'test1');

            await rabbit.exchange('test1').delete();
            assert.throws(() => rabbit.exchange('test1'));
        });
    });
});


