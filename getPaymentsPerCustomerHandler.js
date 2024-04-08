const Redis = require('redis');

const redisClient = Redis.createClient({
    // url: `redis://are-my-1fuxaenocedtk.kxxsr4.0001.use1.cache.amazonaws.com:6379`
    url:`redis://${process.env.REDIS_HOST}:6379`
});

exports.getPaymentsPerCustomerHandler = async (event, context) => {
    redisClient.connect();
    try {
        const customerId = event.pathParameters.customerId;

        if (customerId) {
            // Search for all payment keys that correspond to the provided customerId
            const paymentKeys = await redisClient.keys(`payment_${customerId}_*`);
            const payments = [];

            for (const key of paymentKeys) {
                const payment = await redisClient.json.get(key, { path: '.' });
                payments.push(payment);
            }

            if (payments.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify(payments)
                };
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'No payments found for the given customer ID' })
                };
            }
        } else {
            // No customerId provided, retrieve all payments
            const paymentKeys = await redisClient.keys('payment_*');
            const allPayments = [];

            for (const key of paymentKeys) {
                const payment = await redisClient.json.get(key, { path: '.' });
                allPayments.push(payment);
            }

            return {
                statusCode: 200,
                body: JSON.stringify(allPayments)
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error retrieving payments from Redis', details: error.message })
        };
    }
};