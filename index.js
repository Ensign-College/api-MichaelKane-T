const Redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const { addOrder, getOrder } = require("./services/orderservice.js");
const { addOrderItem, getOrderItem } = require("./services/orderItems.js");
const fs = require("fs");
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json", "utf8"));
const Ajv = require("ajv");
const ajv = new Ajv();

const redisClient = Redis.createClient({
    // url: `redis://are-my-1fuxaenocedtk.kxxsr4.0001.use1.cache.amazonaws.com:6379`
    url:`redis://${process.env.REDIS_HOST}:6379`
});

// Function to handle POST requests for adding boxes
exports.addBoxHandler = async (event, context) => {
    redisClient.connect();
    try {
        const requestBody = JSON.parse(event.body);
        const newBox = requestBody;
        newBox.id = parseInt(await redisClient.json.arrLen('boxes', '$')) + 1;

        await redisClient.json.arrAppend('boxes', '$', newBox);

        return {
            statusCode: 200,
            body: JSON.stringify(newBox)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// Function to handle GET requests for boxes
exports.getBoxesHandler = async (event, context) => {
    redisClient.connect();
    try {
        let boxes = await redisClient.json.get('boxes', { path: '$' });
        return {
            statusCode: 200,
            body: JSON.stringify(boxes[0])
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// Function to handle POST requests for sending payments
exports.sendPaymentHandler = async (event, context) => {
    redisClient.connect();
    try {
        const requestBody = JSON.parse(event.body);
        let {
            billingAddress,
            billingCity,
            billingState,
            billingZipCode,
            phone,
            totalAmount,
            cardId,
            cardType,
            last4digits,
            orderId
        } = requestBody;

        // Reassign customerId to phone number
        customerId = phone;

        // Generate a unique payment ID using customerId and timestamp
        const paymentId = `${customerId}-${Date.now().toString()}`;

        // Construct the payment object
        const payment = {
            customerId,
            billingAddress,
            billingCity,
            billingState,
            billingZipCode,
            phone,
            totalAmount,
            paymentId,
            cardId,
            cardType,
            last4digits,
            orderId
        };

        // Generate a unique key for the payment using phone and current date
        const paymentKey = `payment-${paymentId}`;

        // Store the payment information in Redis as a JSON object
        await redisClient.json.set(paymentKey, '.', payment);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Payment successfully stored in Redis' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// Function to handle GET requests for payment by ID
exports.getPaymentHandler = async (event, context) => {
    redisClient.connect();
    try {
        const paymentId = event.pathParameters.paymentId;

        // Retrieve payment from Redis
        const paymentKey = `payment-${paymentId}`;

        const payment = await redisClient.json.get(paymentKey, { path: '.' });

        if (payment) {
            return {
                statusCode: 200,
                body: JSON.stringify(payment)
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Payment not found for the given payment ID' })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error retrieving payment from Redis', details: error.message })
        };
    }
};

// Function to handle GET requests for payments per customer
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

// Function to handle POST requests for orders
exports.addOrderHandler = async (event, context) => {
    redisClient.connect();
    try {
        const requestBody = JSON.parse(event.body);
        const order = requestBody;

        // Check if required fields are present
        if (!order.productQuantity || !order.ShippingAddress) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing productQuantity or ShippingAddress' })
            };
        }

        // Add order to the database
        await addOrder({ redisClient, order });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Order created successfully', order: order })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

// Function to handle GET requests for orders by ID
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

// Function to handle POST requests for order items
exports.addOrderItemHandler = async (event, context) => {
    redisClient.connect();
    try {
        const requestBody = JSON.parse(event.body);
        const validate = ajv.compile(Schema);
        const valid = validate(requestBody);
        if (!valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Invalid request body" })
            };
        }

        // Add order item to the database
        const orderItemId = await addOrderItem({
            redisClient,
            orderItem: requestBody,
        });

        return {
            statusCode: 201,
            body: JSON.stringify({ orderItemId, message: "Order item added successfully" })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};

// Don't forget to close Redis connection after usage
const closeRedisConnection = () => {
    redisClient.quit();
};

// Exporting functions
module.exports = {
    addBoxHandler,
    getBoxesHandler,
    sendPaymentHandler,
    getPaymentHandler,
    getPaymentsPerCustomerHandler,
    addOrderHandler,
    getOrderHandler,
    addOrderItemHandler
};