export * as amqp from 'amqplib';
export { strict as assert } from 'assert';
import pRetry = require('p-retry');
export { pRetry };
export { EventEmitter, once } from 'events';
export { isDeepStrictEqual } from 'util';
export { trycatch, stringify } from '../utils';

export * from './connection';
export * from './channel';
export * from './queue';
export * from './exchange';
export * from './message';
export * from './binding';
export * from './client';
import { Client } from './client';

const client = new Client();
export default client;
