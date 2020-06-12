import client, { QueueSendProperties, ExchangeSendProperties, Connection, Queue, Exchange, EventEmitter, BindingManager, amqp, trycatch, once, ExchangeType, pRetry, QueueOptions } from './internal';

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

        await this.closeAllQueues()
            .catch(err => console.error('closeAllQueues() failed with error:', err));

        await this.closeAllExchanges()
            .catch(err => console.error('closeAllExchanges() failed with error:', err));

        await this.connection!.close()
            .catch((err: Error) => console.error(`[Client] Connection close() failed with error`, err.toString()));

        this.exchanges = {};
        this.queues = {};
        this.connection = null;

        this.emit('close');
    }

    private closeAllQueues() {
        const promises: Promise<void>[] = [];
        for (const queueName in this.queues) {
            promises.push(this.queues[queueName].close());
        }

        return Promise.all(promises);
    }

    private closeAllExchanges() {
        const promises: Promise<void>[] = [];
        for (const exchangeName in this.exchanges) {
            promises.push(this.exchanges[exchangeName].close());
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

        console.log(`[RabbitMQ Client] Source '${source}' reported error: `, err.toString());
        console.log(`[RabbitMQ Client] Starting reinitialize...`);

        this.isReady = false;
        this.initialize();
    }

    async declareExchange(name: string, type: ExchangeType, options: amqp.Options.AssertExchange = {}) {
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
        await this.waitForInitialize();

        if (this.queues[name]) {
            throw new Error(`Queue with name ${name} already declared`);
        }

        const queue = new Queue(this.connection!, name, options);
        await queue.initialize();

        this.queues[name] = queue;

        return queue;
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
    }

    private declareQueues(queues: Topology.QueueParams[]) {
        const promises = queues.map(queue => {
            const { name, options } = queue;
            return this.declareQueue(name, options);
        });

        return Promise.all(promises);
    }

    private declareExchanges(exchanges: Topology.ExchangeParams[]) {
        const promises = exchanges.map(exchange => {
            const { name, type, options } = exchange;
            return this.declareExchange(name, type, options);
        });

        return Promise.all(promises);
    }

    private applyBindings(bindings: Topology.BindingParams[]) {
        const promises = bindings.map(binding => {
            const { source, destination, pattern, args } = binding;
            return this.bind(source, destination, pattern, args);
        });

        return Promise.all(promises);
    }

    private async rebuildTopology() {
        for (const exchangeName in this.exchanges) {
            await this.exchanges[exchangeName].initialize();
        }

        for (const queueName in this.queues) {
            await this.queues[queueName].initialize();
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

        await exchange.channel!.deleteExchange(name, { ifUnused });

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

        await queue.channel!.deleteQueue(name, options);

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

        return exchange ? exchange : queue;
    }

    async bind(source: Exchange | string, destination: Exchange | Queue | string, pattern: string = '', args?: any) {
        await this.waitForInitialize();

        if (typeof source === 'string') {
            if (!this.exchanges[source]) {
                throw new Error(`Exchange with name ${source} was not declared`);
            }

            source = this.exchanges[source];
        }

        if (typeof destination === 'string') {
            destination = this.getEntityByName(destination);
        }

        await this.bindings.addBinding(source, destination, pattern, args);
    }

    async send(entityName: string, content: string | Object | Buffer, properties?: ExchangeSendProperties | QueueSendProperties, routingKey?: string) {
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
    return pRetry(
        () => func(),
        {
            retries: 1,
            onFailedAttempt: async (error) => {
                client.reportError(source, error);
                await client.waitForInitialize();
            },
        }
    );
}

export namespace Topology {
    export interface ExchangeParams {
        name: string,
        type: ExchangeType,
        options?: amqp.Options.AssertExchange,
    }

    export interface QueueParams {
        name: string,
        options?: QueueOptions,
    }

    export interface BindingParams {
        source: string,
        destination: string,
        pattern?: string,
        args?: any,
    }
}

export interface Topology {
    exchanges?: Topology.ExchangeParams[];
    queues?: Topology.QueueParams[];
    bindings?: Topology.BindingParams[];
}

const defaultRetryOptions: pRetry.Options = {
    retries: 5,
}

export type ErrorSource = 'connection' | 'channel' | 'queue' | 'consumer' | 'exchange';
