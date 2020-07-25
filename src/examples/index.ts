/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
import * as yargs from 'yargs';
import rabbit, { ConsumerMessage } from '../lib';
import config from '../config';

const { argv } = yargs;

const sleep = (timeout: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
};

const main = async () => {
    const { uri } = config.rabbit;
    await rabbit.connect(uri);

    await rabbit.declareTopology({
        exchanges: [{ name: 'ex1', type: 'fanout' }],
        queues: [{ name: 'q1' }, { name: 'q2' }],
        bindings: [
            { source: 'ex1', destination: 'q1' },
            { source: 'ex1', destination: 'q2' },
        ],
    });

    if (!argv.producer) {
        console.log('[Consumer mode] Waiting for incoming messages...');
        await rabbit.queue('q2').activateConsumer((message: ConsumerMessage) => {
            console.log('q2 received message: ', message.getContent());
            message.ack();
        });
    } else {
        const messageCount = (argv.count as number) || 100;
        const timeout = (argv.timeout as number) || 1000;

        console.log(`[Producer mode] Sending ${messageCount} messages with ${timeout} ms timeout`);

        for (let i = 0; i < messageCount; i++) {
            const message = `Test ${i}/${messageCount - 1}, timeout: ${timeout} ms`;
            console.log(`Sending message: ${message}`);

            await rabbit.exchange('ex1').send(message);
            await sleep(timeout);
        }

        await rabbit.close();
    }
};

main().catch((err) => {
    console.error(`Mail failed with error: `, err);
    process.exit(1);
});
