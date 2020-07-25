module.exports = {
    semi: true,
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 150,
    tabWidth: 4,
    endOfLine: 'auto',

    overrides: [
        {
            files: '*.json',
            options: {
                tabWidth: 2,
            },
        },
        {
            files: '*.yml',
            options: {
                tabWidth: 2,
            },
        },
    ],
};
