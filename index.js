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
    url: `redis://${process.env.REDIS_HOST}:6379`, // Use environment variable for Redis host
    connect_timeout: 20000, // 5 seconds connection timeout
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
        // Customer already exists, update their information
        const clientKey = `client:${userPaymentDetails.customerID}-${dateStamp}-00`;
        await redisClient.json.set(clientKey, '$', userPaymentDetails);
        console.log(`Updated customer information for ${clientID}`);
    } else {
        // Customer does not exist, create a new customer
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
        
        console.error(keysPattern);

        if (customerKeys.length === 0) {
            res.status(404).send(`No payment details found for customer ID ${customerID}`);
            console.error(keysPattern);
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

app.post("/orders", async (req, res) => {
    let order = req.body;

    let responseStatus = (order.productQuantity && order.ShippingAddress) ? 200 : 400;

    if (responseStatus === 200) {
        try {
            await addOrder({ redisClient, order });
        } catch (error) {
            console.error(error);
            res.status(500).send("Internal Server Error Occurred");
            return;
        }
    } else {
        res.status(responseStatus);
        res.send(`Missing one of the Following Fields: ${order.productQuantity ? "" : "productQuantity"} ${order.ShippingAddress ? "" : "ShippingAddress"}`);
    }
    res.status(responseStatus).send();
});

app.get("/orders/:orderID", async (req, res) =>{

    //get order from the database
    const orderID = req.params.orderID;
    let order = await getOrder({redisClient,orderID});
    if(order === null){
        res.status(404).send("Order not Found");
    }else {
        res.json(order);
    }
})

app.post("/orderItems",async (req, res)=>{
    try{
        console.log("Schema:",Schema);
        const validate = ajv.compile(Schema);
        const valid = validate(req.body);
        if(!valid){
         return res.status(400).json({error: "Invalid request body"})
        }
        console.log("Request body:", req.body);
        //callng orderItem function and storingthe result
        const orderItemId = await addOrderItem({
            redisClient,
            orderItem: req.body,
        })
        //responding with the result
        res.status(201).json({
            orderItemId,
            message: "Order Item Added Successfully"
        });
    }catch(error){

        console.error("Error Adding Order Item", error);
        res.status(500).json({error: "Internal Server Error"});
    }
})

app.get("/ordersItems/:orderItemId", async (req,res)=> {
    try{
        const orderItemId = req.params.orderItemId;
        const orderItem = await getOrderItem({ redisClient,orderItem});
        res.json(orderItem);
    }catch(error){
        console.error("Error getting order Item:", error);
        res.status(500).json({error:"Internal server error"});
    }
}) 

const server = serverless.createServer(app);

exports.handler = async (event, context) => {
    redisClient.on('error', (error) => {
        console.error('Redis error:', error);
    });
    redisClient.on('ready', () => {
        console.log('Redis connection established');
    }); 
    
    try {
        return serverless.proxy(server, event, context, 'PROMISE').promise;
    }
    catch (error) {
        console.error('Error handling request Chimbozama Futi:', error);
        return error;
    }
    
    
};
