import { Message } from '../lib/internal';

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

            expect(message.getContent()).toEqual(contentObject);
        });

        it('should setContent as String', () => {
            const message = new Message(contentString);

            expect(message.getContent()).toEqual(contentString);
        });

        it('should setContent as Buffer', () => {
            const buffer = Buffer.from(contentString);
            const message = new Message(buffer);

            expect(message.getRawContent()).toEqual(buffer);
            expect(message.getContent()).toEqual(contentString);
        });
    });
});
