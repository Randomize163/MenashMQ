import { pipeline } from 'stream';
import { promisify } from 'util';

export * from '../lib';

export const promisePipe = promisify(pipeline);

export const trycatch = async (func: Function, ...args: any[]) => {
    const ret: { result?: any; err?: any } = {};

    try {
        ret.result = await func(...args);
    } catch (err) {
        ret.err = err;
    }

    return ret;
};

const addErrorReplacerToReplacer = (replacer: ((key: any, value?: any) => any) | null) => (_key: any, value: any) => {
    if (value instanceof Error) {
        const error = {};

        const allowedErrorProperties = ['message', 'stack'];

        Object.getOwnPropertyNames(value)
            .filter((key) => allowedErrorProperties.includes(key))
            .forEach((key) => {
                error[key] = value[key];
            });

        return error;
    }

    if (replacer) {
        return replacer(value);
    }

    return value;
};

export const stringify = (object: any, space = 2, replacer = null) => {
    return JSON.stringify(object, addErrorReplacerToReplacer(replacer), space);
};
