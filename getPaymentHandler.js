const Redis = require('redis');

const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;

const redisClient = Redis.createClient({
    socket: {
        host: redisHost,
        port: redisPort
      },
      tls: {},
      ssl: true,
  });

redisClient.on('error', err => console.error('Error de conexión con ElastiCache:', err));

exports.getPaymentHandler = async (event, context) => {
    try {
        console.log('getPaymentHandler START');

        await redisClient.connect();

        const paymentId = event.pathParameters.paymentId;

        const paymentKey = `payment-${paymentId}`;
        console.log(`getPaymentHandler paymentId: ${paymentId}`);

        const payment = await redisClient.json.get(paymentKey, { path: '.' });

        if (payment) {
            return {
                statusCode: 200,
                body: JSON.stringify(payment)
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: `Payment not found for the given payment ID: ${paymentId}` })
            };
        }
    } catch (error) {
        console.error('Unhandled error in getPaymentHandler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error retrieving payment from Redis', details: error.message })
        };
    } finally {
        await redisClient.quit();
    }
};
