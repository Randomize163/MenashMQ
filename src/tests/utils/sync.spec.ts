import { Event } from '../../utils/sync';

describe('Event tests', () => {
    it('should wait for event once', async () => {
        const event = new Event();

        let signaled = false;
        setTimeout(() => {
            signaled = true;
            event.signal();
        }, 0);

        await expect(event.wait()).resolves.toBeUndefined();
        expect(signaled).toBeTruthy();
    });

    it('should return if event was signaled', async () => {
        const event = new Event();

        let signaled = false;
        setTimeout(() => {
            signaled = true;
            event.signal();
        }, 0);

        await expect(event.wait()).resolves.toBeUndefined();
        expect(signaled).toBeTruthy();

        await expect(event.wait()).resolves.toBeUndefined();
    });

    it('should ignore double signal', async () => {
        const event = new Event();

        let signaled = false;
        setTimeout(() => {
            signaled = true;
            event.signal();
        }, 0);

        await expect(event.wait()).resolves.toBeUndefined();
        expect(signaled).toBeTruthy();

        event.signal();
        await expect(event.wait()).resolves.toBeUndefined();
    });

    it('should reset event', async () => {
        const event = new Event();

        let signaled = false;
        setTimeout(() => {
            signaled = true;
            event.signal();
        }, 0);

        await expect(event.wait()).resolves.toBeUndefined();
        expect(signaled).toBeTruthy();

        event.reset();
        signaled = false;

        setTimeout(() => {
            signaled = true;
            event.signal();
        }, 0);

        expect(signaled).toBeFalsy();
        await expect(event.wait()).resolves.toBeUndefined();
        expect(signaled).toBeTruthy();
    });
});
