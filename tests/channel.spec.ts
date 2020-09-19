import { Connection, Channel } from '../src/lib/internal';

const testConfig = {
    rabbit: {
        uri: 'amqp://localhost',
    },
};

describe('Channel tests', () => {
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
        it('should initialize and close channel', async () => {
            const channel = new Channel(connection);

            for (let i = 0; i < 50; i++) {
                await channel.initialize();
                expect(channel.isInitialized()).toBeTruthy();

                await channel.close();
                expect(channel.isInitialized()).toBeFalsy();
            }
        });

        it('should initialize channel', async () => {
            const channel = new Channel(connection);

            for (let i = 0; i < 50; i++) {
                await channel.initialize();
                expect(channel.isInitialized()).toBeTruthy();
            }

            await channel.close();
            expect(channel.isInitialized()).toBeFalsy();
        });
    });

    describe('Close tests', () => {
        it('should ignore multiple close channel', async () => {
            const channel = new Channel(connection);

            await channel.initialize();
            expect(channel.isInitialized()).toBeTruthy();

            for (let i = 0; i < 50; i++) {
                await channel.close();
                expect(channel.isInitialized()).toBeFalsy();
            }
        });
    });

    describe('Prefetch tests', () => {
        it('should configure prefetch', async () => {
            const channel = new Channel(connection);

            await channel.initialize();
            expect(channel.isInitialized()).toBeTruthy();

            for (let i = 1; i < 500; i += 5) {
                await channel.prefetch(i);
            }

            await channel.close();
            expect(channel.isInitialized()).toBeFalsy();
        });
    });

    describe('getNativeChannel() tests', () => {
        it('should return native channel', async () => {
            const channel = new Channel(connection);

            await channel.initialize();
            expect(channel.isInitialized()).toBeTruthy();

            expect(channel.getNativeChannel()).toBe(channel.channel);

            await channel.close();
            expect(channel.isInitialized()).toBeFalsy();
        });

        it('should throw if channel is not initialized', async () => {
            const channel = new Channel(connection);

            expect(channel.isInitialized()).toBeFalsy();

            expect(() => channel.getNativeChannel()).toThrowError(
                '[BUG] Trying to get native channel, but Channel was closed or was not initialized yet',
            );

            await channel.initialize();
            await channel.close();

            expect(channel.isInitialized()).toBeFalsy();
            expect(() => channel.getNativeChannel()).toThrowError(
                '[BUG] Trying to get native channel, but Channel was closed or was not initialized yet',
            );
        });
    });
});
