const Redis = require('redis');
const { getOrder } = require("./services/orderservice.js");

const redisClient = Redis.createClient({
    // url: `redis://localhost:6379`
    url:`redis://${process.env.REDIS_HOST}:6379`
});

exports.getOrderHandler = async (event, context) => {
    redisClient.connect();
    try {
        const orderId = event.pathParameters.orderId;

        // Retrieve order from the database
        const order = await getOrder({ redisClient, orderId });

        if (order) {
            return {
                statusCode: 200,
                body: JSON.stringify(order)
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Order not found' })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};