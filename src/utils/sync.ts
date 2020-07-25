import { EventEmitter, once } from 'events';

export class Event {
    private event: EventEmitter;

    private signaled: boolean = false;

    constructor() {
        this.event = new EventEmitter();
    }

    signal() {
        if (!this.signaled) {
            this.event.emit('finish');
            this.signaled = true;
        }
    }

    async wait() {
        if (this.signaled) {
            return;
        }

        await once(this.event, 'finish');
    }

    reset() {
        this.signaled = false;
    }
}
