import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { assert } from 'chai';
import 'mocha';
import { Connection } from '../lib/internal';

chai.use(chaiAsPromised);

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    },
};

describe('Connection tests', () => {
    describe('Initialize tests', () => {
        it('should initialize and close connection', async () => {
            const connection = new Connection(testConfig.rabbit.uri);

            for (let i = 0; i < 50; i++) {
                await connection.initialize();
                assert(connection.isConnected());

                await connection.close();
                assert(!connection.isConnected());
            }
        });

        it('should initialize connection', async () => {
            const connection = new Connection(testConfig.rabbit.uri);

            for (let i = 0; i < 50; i++) {
                await connection.initialize();
                assert(connection.isConnected());
            }

            await connection.close();
            assert(!connection.isConnected());
        });
    });
});
