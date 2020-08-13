import { pipeline } from 'stream';
import { promisify } from 'util';

export * from './sync';

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

type ReplacerFunction = (key: any, value: any) => any;

const addErrorReplacerToReplacer = (replacer?: ReplacerFunction) => (key: any, value: any) => {
    if (value instanceof Error) {
        const error = {};

        const allowedErrorProperties = ['message', 'stack'];

        Object.getOwnPropertyNames(value)
            .filter((objectKey) => allowedErrorProperties.includes(objectKey))
            .forEach((objectKey) => {
                error[objectKey] = value[objectKey];
            });

        return error;
    }

    if (replacer) {
        return replacer(key, value);
    }

    return value;
};

export const stringify = (object: any, space = 2, replacer?: ReplacerFunction) => {
    return JSON.stringify(object, addErrorReplacerToReplacer(replacer), space);
};
