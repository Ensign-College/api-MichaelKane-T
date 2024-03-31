const express = require('express');
const app = express();
const Redis = require('redis');
const bodyParser = require('body-parser');
const serverless = require('aws-serverless-express');
const { addOrder, getOrder } = require("./orderservice");
const { addOrderItem, getOrderItem } = require("./orderItems");
const fs = require("fs");
const Schema = JSON.parse(fs.readFileSync("./orderItemSchema.json", "utf8"));
const Ajv = require("ajv");
const ajv = new Ajv();

// Configure Redis client to connect to ElastiCache cluster
const redisClient = Redis.createClient({
    host: `mic-my-13rca21flex19.kxxsr4.0001.use1.cache.amazonaws.com`, // Use environment variable for Redis host
    port: 6379
});

redisClient.on('connect', () => {
    initializeCustomerPaymentsKey(redisClient);
});

app.use(bodyParser.json());

const initializeCustomerPaymentsKey = async (redisClient) => {
    try {
        if (!redisClient.connected) {
            const keyExists = await redisClient.exists('customerPayments');
            if (!keyExists) {
                await redisClient.json.set('customerPayments', '$', []);
            }
        }

    } catch (error) {
        console.error('Error initializing Redis key:', error);
    }
};

const addCustomer = async ({ redisClient, userPaymentDetails }) => {
    const dateStamp = new Date().getTime();
    const clientID = `customer:${userPaymentDetails.customerID}-${dateStamp}`;
    const existingPayments = await redisClient.json.get(clientID);


    if (existingPayments !== null) {
        const clientKey = `client:${userPaymentDetails.customerID}-${dateStamp}-00`;
        await redisClient.json.set(clientKey, '$', userPaymentDetails);
        console.log(`Updated customer information for ${clientID}`);
    } else {
        const clientKey = `client:${userPaymentDetails.customerID}-${dateStamp}-00`;
        await redisClient.json.set(clientKey, '$', userPaymentDetails);
        console.log(`Added new customer with ID ${clientID}`);
    }
};


app.get('/payments/:customerID', async (req, res) => {
    try {
        const customerID = req.params.customerID;
        const keysPattern = `${customerID}`;
        const customerKeys = await redisClient.keys(keysPattern);

        if (customerKeys.length === 0) {
            res.status(404).send(`No payment details found for customer ID ${customerID}`);
            return;
        }

        const customersData = [];
        for (const key of customerKeys) {
            const customerData = await redisClient.json.get(key, { path: '$' });
            customersData.push(customerData);
        }

        res.send(customersData);
    } catch (error) {
        console.error(error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.post('/payments', async (req, res) => {
    const userPaymentDetails = req.body;
    const requiredFields = ['customerID', 'firstName', 'lastName', 'cardNumber', 'expiryDate', 'cvv', 'address', 'city', 'state', 'zipCode'];

    if (requiredFields.every(field => userPaymentDetails[field] !== undefined && userPaymentDetails[field] !== null)) {
        try {
            await addCustomer({ redisClient, userPaymentDetails });
            res.status(200).send('Payment details added successfully');
        } catch (error) {
            console.error(error);
            res.status(500).send(`Error: ${error.message}`);
        }
    } else {
        res.status(400).send(`Missing one or more required fields: ${requiredFields.join(', ')}`);
    }
});

// Define other routes for orders, order items, etc.

// Create a handler for AWS Lambda
const server = serverless.createServer(app);

exports.handler = async (event, context) => {
    return serverless.proxy(server, event, context, 'PROMISE').promise;
};
