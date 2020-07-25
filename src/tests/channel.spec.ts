import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { assert } from 'chai';
import 'mocha';
import { Connection, Channel } from '../lib/internal';

chai.use(chaiAsPromised);

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    },
};

describe('Channel tests', () => {
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
        it('should initialize and close channel', async () => {
            const channel = new Channel(connection);

            for (let i = 0; i < 50; i++) {
                await channel.initialize();
                assert(channel.isInitialized());

                await channel.close();
                assert(!channel.isInitialized());
            }
        });

        it('should initialize channel', async () => {
            const channel = new Channel(connection);

            for (let i = 0; i < 50; i++) {
                await channel.initialize();
                assert(channel.isInitialized());
            }

            await channel.close();
            assert(!channel.isInitialized());
        });
    });

    describe('Prefetch tests', () => {
        it('should configure prefetch', async () => {
            const channel = new Channel(connection);

            await channel.initialize();
            assert(channel.isInitialized());

            for (let i = 1; i < 500; i += 5) {
                await channel.prefetch(i);
            }

            await channel.close();
            assert(!channel.isInitialized());
        });
    });
});
