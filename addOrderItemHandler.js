const Redis = require('redis');
const { addOrderItem } = require("./services/orderItems.js");
const fs = require("fs");
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json", "utf8"));
const Ajv = require("ajv");
const ajv = new Ajv();

const redisClient = Redis.createClient({
    // url: `redis://localhost:6379`
    url:`redis://${process.env.REDIS_HOST}:6379`
});

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