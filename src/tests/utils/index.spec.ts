import { trycatch, stringify } from '../../utils';

describe('trycatch tests', () => {
    const mockFn = jest.fn();
    const expectedResult = 'some value';
    const expectedError = new Error('some error');

    beforeEach(() => {
        mockFn.mockReset();
    });

    it('should return result', async () => {
        mockFn.mockReturnValueOnce(expectedResult);

        const { result, err } = await trycatch(mockFn);
        expect(err).toBeUndefined();
        expect(result).toEqual(expectedResult);
    });

    it('should catch and return error', async () => {
        mockFn.mockRejectedValue(expectedError);

        const { result, err } = await trycatch(mockFn);
        expect(result).toBeUndefined();
        expect(err).toEqual(expectedError);
    });

    it('should work with async functions', async () => {
        mockFn.mockResolvedValue(expectedResult);

        const { result, err } = await trycatch(mockFn);
        expect(err).toBeUndefined();
        expect(result).toEqual(expectedResult);
    });

    it('should pass all params to a function', async () => {
        mockFn.mockResolvedValue(expectedResult);

        const { result, err } = await trycatch(mockFn, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
        expect(err).toBeUndefined();
        expect(result).toEqual(expectedResult);

        expect(mockFn.mock.calls[0].length).toEqual(10);
        mockFn.mock.calls[0].forEach((parameter, index) => {
            expect(parameter).toEqual(index);
        });
    });
});

describe('stringify tests', () => {
    const simpleObject = {
        a: {
            z: 1,
            b: {
                z: 1,
                c: {
                    d: 123456,
                },
            },
        },
        e: {
            f: 123456,
        },
        k: 1,
    };

    const errorObject = new Error('Here is Johnny!');

    it('should stringify regular object', () => {
        for (let spaces = 0; spaces < 5; spaces++) {
            expect(stringify(simpleObject, spaces)).toEqual(JSON.stringify(simpleObject, null, spaces));
        }
    });

    it('should stringify error object', () => {
        const expectedErrorTransformation = {
            stack: errorObject.stack,
            message: errorObject.message,
        };

        for (let spaces = 0; spaces < 5; spaces++) {
            expect(stringify(errorObject, spaces)).toEqual(JSON.stringify(expectedErrorTransformation, null, spaces));
        }
    });

    it('should work with a custom replacer', () => {
        const mockReplacer = jest.fn((key, value?) => {
            if (key === 'z') {
                return value + 1;
            }

            if (key === 'k') {
                return value + 10;
            }

            return value;
        });

        for (let spaces = 0; spaces < 5; spaces++) {
            expect(stringify(simpleObject, spaces, mockReplacer)).toEqual(JSON.stringify(simpleObject, mockReplacer, spaces));
        }
    });

    it('should use default of 2 spaces', () => {
        expect(stringify(simpleObject)).toEqual(JSON.stringify(simpleObject, null, 2));
    });
});
