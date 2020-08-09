/* eslint-disable max-classes-per-file */
import { QueueSendProperties, ExchangeSendProperties, amqp, Queue, assert } from './internal';

export class Message {
    private content: Buffer;

    constructor(content: Buffer | String | Object, public properties: QueueSendProperties | ExchangeSendProperties = {}) {
        this.setContent(content);
    }

    setContent(content: Buffer | String | Object) {
        if (typeof content === 'string') {
            this.content = Buffer.from(content);
        } else if (Buffer.isBuffer(content)) {
            this.content = content;
        } else {
            this.content = Buffer.from(JSON.stringify(content));
            this.properties.contentType = 'application/json';
        }
    }

    getContent(): String | Object {
        let content = this.content.toString();

        if (this.properties.contentType === 'application/json') {
            content = JSON.parse(content);
        }

        return content;
    }

    getRawContent() {
        return this.content;
    }
}

export class ConsumerMessage extends Message {
    acked: boolean = false;
    nacked: boolean = false;
    fields: amqp.MessageFields;

    constructor(private message: amqp.Message, private queue: Queue) {
        super(message.content, message.properties);
        this.fields = message.fields;
    }

    ack() {
        if (this.isProcessed()) {
            throw new Error(`[BUG] message already processed ack: ${this.acked} nack: ${this.nacked}`);
        }

        assert(this.queue.channel);

        this.queue.getNativeChannel().ack(this.message);

        this.acked = true;
    }

    nack(requeue = true, allUpTo = false) {
        if (this.isProcessed()) {
            throw new Error(`[BUG] message already processed ack: ${this.acked} nack: ${this.nacked}`);
        }

        assert(this.queue.channel);

        this.queue.getNativeChannel().nack(this.message, allUpTo, requeue);

        this.nacked = true;
    }

    reject(requeue = true) {
        this.nack(requeue);
    }

    isProcessed() {
        return this.acked || this.nacked;
    }

    static from(msg: amqp.Message, queue: Queue) {
        const message = new ConsumerMessage(msg, queue);
        return message;
    }
}
