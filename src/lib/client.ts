import client, {
    QueueSendProperties,
    ExchangeSendProperties,
    Connection,
    Queue,
    Exchange,
    EventEmitter,
    BindingManager,
    amqp,
    trycatch,
    once,
    ExchangeType,
    pRetry,
    QueueOptions,
    ConsumeFunction,
} from './internal';

const defaultRetryOptions: pRetry.Options = {
    retries: 5,
};

export class Client extends EventEmitter {
    connection: Connection | null = null;

    exchanges: { [name: string]: Exchange };
    queues: { [name: string]: Queue };
    bindings: BindingManager = new BindingManager();

    retryOptions: pRetry.Options;

    isReady: boolean = false;
    isClosed: boolean = true;

    constructor() {
        super();

        this.exchanges = {};
        this.queues = {};
    }

    async connect(url: string | amqp.Options.Connect, retryOptions: pRetry.Options = defaultRetryOptions, socketOptions?: any) {
        if (this.connection) {
            throw new Error('Connection was already created');
        }

        const connection = new Connection(url, socketOptions);
        await Client.initializeConnectionWithRetries(connection, retryOptions);

        this.connection = connection;
        this.retryOptions = retryOptions;
        this.isReady = true;
        this.isClosed = false;
    }

    private static initializeConnectionWithRetries(connection: Connection, retryOptions: pRetry.Options) {
        return pRetry(() => connection!.initialize(), retryOptions);
    }

    private async initialize() {
        if (this.isReady) {
            return;
        }

        const { err } = await trycatch(() => this.initializeHelper());
        if (err) {
            this.isReady = false;

            this.emit('error', err);

            this.close();
            return;
        }

        // eslint-disable-next-line no-console
        console.log(`[RabbitMQ Client] Client is ready`);

        this.isReady = true;
        this.emit('ready');
    }

    private async initializeHelper() {
        await this.closeAllExchanges();

        await this.closeAllQueues();

        await Client.initializeConnectionWithRetries(this.connection!, this.retryOptions);

        await this.rebuildTopology();
    }

    async close() {
        if (this.isClosed) {
            return;
        }

        this.isClosed = true;

        this.bindings.clearBindings();

        // eslint-disable-next-line no-console
        await this.closeAllQueues().catch((err) => console.error('closeAllQueues() failed with error:', err));

        // eslint-disable-next-line no-console
        await this.closeAllExchanges().catch((err) => console.error('closeAllExchanges() failed with error:', err));

        // eslint-disable-next-line no-console
        await this.connection!.close().catch((err: Error) => console.error(`[Client] Connection close() failed with error`, err.toString()));

        this.exchanges = {};
        this.queues = {};
        this.connection = null;

        this.emit('close');
    }

    private closeAllQueues() {
        const promises: Promise<void>[] = [];
        for (const queue of Object.values(this.queues)) {
            promises.push(queue.close());
        }

        return Promise.all(promises);
    }

    private closeAllExchanges() {
        const promises: Promise<void>[] = [];
        for (const exchange of Object.values(this.exchanges)) {
            promises.push(exchange.close());
        }

        return Promise.all(promises);
    }

    async waitForInitialize() {
        if (this.isClosed) {
            throw new Error(`Client was closed`);
        }

        if (!this.isReady) {
            await once(client, 'ready');
        }
    }

    reportError(source: ErrorSource, err: Error) {
        if (!this.isReady) {
            return;
        }

        // eslint-disable-next-line no-console
        console.log(`[RabbitMQ Client] Source '${source}' reported error: `, err.toString());
        // eslint-disable-next-line no-console
        console.log(`[RabbitMQ Client] Starting reinitialize...`);

        this.isReady = false;
        this.initialize();
    }

    async declareExchange(name: string, type: ExchangeType, options: amqp.Options.AssertExchange = {}) {
        if (!name) {
            throw new Error('Exchange name is a required parameter');
        }

        if (!type || !Exchange.getTypes().includes(type)) {
            throw new Error(`Exchange type is a required parameter and should be one of the following options: ${Exchange.getTypes().toString()}`);
        }

        await this.waitForInitialize();

        if (this.exchanges[name]) {
            throw new Error(`Exchange with name ${name} already declared`);
        }

        const exchange = new Exchange(this.connection!, name, type, options);
        await exchange.initialize();

        this.exchanges[name] = exchange;

        return exchange;
    }

    async declareQueue(name: string, options: amqp.Options.AssertQueue = {}) {
        if (!name) {
            throw new Error('Exchange name is a required parameter');
        }

        await this.waitForInitialize();

        if (this.queues[name]) {
            throw new Error(`Queue with name ${name} already declared`);
        }

        const queue = new Queue(this.connection!, name, options);
        await queue.initialize();

        this.queues[name] = queue;

        return queue;
    }

    queue(name: string) {
        if (!name) {
            throw new Error('Parameter name should be provided for a queue');
        }

        const queue = this.queues[name];
        if (!queue) {
            throw new Error(`Queue with name ${name} was not declared or was deleted`);
        }

        return queue;
    }

    exchange(name: string) {
        if (!name) {
            throw new Error('Parameter name should be provided for an exchange');
        }

        const exchange = this.exchanges[name];
        if (!exchange) {
            throw new Error(`Exchange with name ${name} was not declared or was deleted`);
        }

        return exchange;
    }

    async declareTopology(topology: Topology) {
        await this.waitForInitialize();

        if (topology.exchanges) {
            await this.declareExchanges(topology.exchanges);
        }

        if (topology.queues) {
            await this.declareQueues(topology.queues);
        }

        if (topology.bindings) {
            await this.applyBindings(topology.bindings);
        }

        if (topology.consumers) {
            await this.activateConsumers(topology.consumers);
        }
    }

    private declareQueues(queues: Topology.QueueParams[]) {
        const promises = queues.map((queue) => {
            const { name, options } = queue;
            return this.declareQueue(name, options);
        });

        return Promise.all(promises);
    }

    private declareExchanges(exchanges: Topology.ExchangeParams[]) {
        const promises = exchanges.map((exchange) => {
            const { name, type, options } = exchange;
            return this.declareExchange(name, type, options);
        });

        return Promise.all(promises);
    }

    private applyBindings(bindings: Topology.BindingParams[]) {
        const promises = bindings.map((binding) => {
            const { source, destination, pattern, args } = binding;
            return this.bind(source, destination, pattern, args);
        });

        return Promise.all(promises);
    }

    private activateConsumers(consumers: Topology.ConsumerParams[]) {
        const promises = consumers.map((consumer) => {
            const { queueName, onMessage, options } = consumer;
            return this.queue(queueName).activateConsumer(onMessage, options);
        });

        return Promise.all(promises);
    }

    private async rebuildTopology() {
        for (const exchange of Object.values(this.exchanges)) {
            await exchange.initialize();
        }

        for (const queue of Object.values(this.queues)) {
            await queue.initialize();
        }

        await this.bindings.rebindAll();
    }

    async deleteExchange(name: string, ifUnused: boolean = true) {
        await this.waitForInitialize();

        const exchange = this.exchanges[name];
        if (!exchange) {
            throw Error(`Exchange with name ${name} does not exist`);
        }

        if (!exchange.isInitialized()) {
            throw Error(`Exchange with name ${name} was not initialized`);
        }

        await this.bindings.unbindAllBindingsForEntity(exchange);

        await exchange.getNativeChannel().deleteExchange(name, { ifUnused });

        await exchange.close();

        delete this.exchanges[name];
    }

    async deleteQueue(name: string, options: amqp.Options.DeleteQueue = {}) {
        await this.waitForInitialize();

        const queue = this.queues[name];
        if (!queue) {
            throw Error(`Queue with name ${name} does not exist`);
        }

        if (!queue.isInitialized()) {
            throw Error(`Exchange with name ${name} was not initialized`);
        }

        await this.bindings.unbindAllBindingsForEntity(queue);

        await queue.getNativeChannel().deleteQueue(name, options);

        await queue.close();

        delete this.queues[name];
    }

    private getEntityByName(entityName: string) {
        const exchange = this.exchanges[entityName];
        const queue = this.queues[entityName];

        if (exchange && queue) {
            throw new Error('There are both exchange and queue with the same name');
        }

        if (!exchange && !queue) {
            throw new Error(`There is no entity with name ${entityName}`);
        }

        return exchange || queue;
    }

    async bind(source: Exchange | string, destination: Exchange | Queue | string, pattern: string = '', args?: any) {
        await this.waitForInitialize();

        const sourceEntity = typeof source === 'string' ? this.exchange(source) : source;
        const destinationEntity = typeof destination === 'string' ? this.getEntityByName(destination) : destination;

        await this.bindings.addBinding(sourceEntity, destinationEntity, pattern, args);
    }

    async send(
        entityName: string,
        content: string | Object | Buffer,
        properties?: ExchangeSendProperties | QueueSendProperties,
        routingKey?: string,
    ) {
        if (this.exchanges[entityName]) {
            return this.exchanges[entityName].send(content, routingKey, properties);
        }

        if (this.queues[entityName]) {
            if (routingKey) {
                throw new Error(`Send to queue should not get routingKey parameter`);
            }

            return this.queues[entityName].send(content, properties);
        }

        throw new Error(`Entity with name ${entityName} was not declared`);
    }
}

export const tryOnce = async (func: Function, source: ErrorSource) => {
    return pRetry(() => func(), {
        retries: 1,
        onFailedAttempt: async (error) => {
            client.reportError(source, error);
            await client.waitForInitialize();
        },
    });
};

export namespace Topology {
    export interface ExchangeParams {
        name: string;
        type: ExchangeType;
        options?: amqp.Options.AssertExchange;
    }

    export interface QueueParams {
        name: string;
        options?: QueueOptions;
    }

    export interface BindingParams {
        source: string;
        destination: string;
        pattern?: string;
        args?: any;
    }

    export interface ConsumerParams {
        queueName: string;
        onMessage: ConsumeFunction;
        options?: amqp.Options.Consume;
    }
}

export interface Topology {
    exchanges?: Topology.ExchangeParams[];
    queues?: Topology.QueueParams[];
    bindings?: Topology.BindingParams[];
    consumers?: Topology.ConsumerParams[];
}

export type ErrorSource = 'connection' | 'channel' | 'queue' | 'consumer' | 'exchange';
