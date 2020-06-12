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

});


