import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { assert } from 'chai';
import 'mocha';
import { Message } from '../lib/internal';

chai.use(chaiAsPromised);

const contentObject = {
    first: 'value',
    second: 2,
    third: [1, 2, 3],
    b: false,
    rec: {
        first: 'value',
        second: 2,
        third: [1, 2, 3],
        b: false,
    },
};

const contentString = 'Test content for getContent()';

describe('Message tests', () => {
    describe('Content tests', () => {
        it('should setContent as Object', () => {
            const message = new Message(contentObject);

            assert.deepEqual(message.getContent(), contentObject);
        });

        it('should setContent as String', () => {
            const message = new Message(contentString);

            assert.equal(message.getContent(), contentString);
        });

        it('should setContent as Buffer', () => {
            const buffer = Buffer.from(contentString);
            const message = new Message(buffer);

            assert.equal(message.getRawContent(), buffer);
            assert.equal(message.getContent(), contentString);
        });
    });
});
