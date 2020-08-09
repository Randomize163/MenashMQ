import { Connection } from '../lib/internal';

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
                expect(connection.isConnected()).toBeTruthy();

                await connection.close();
                expect(connection.isConnected()).toBeFalsy();
            }
        });

        it('should initialize connection', async () => {
            const connection = new Connection(testConfig.rabbit.uri);

            for (let i = 0; i < 50; i++) {
                await connection.initialize();
                expect(connection.isConnected()).toBeTruthy();
            }

            await connection.close();
            expect(connection.isConnected()).toBeFalsy();
        });
    });
});
