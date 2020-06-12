export const config = {
    service: {
        port: +(process.env.PORT ?? 8000),
    },
    rabbit: {
        uri: 'amqp://localhost',
    }
};