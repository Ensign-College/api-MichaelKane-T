const express = require('express');//Express makes APIs connects front end to back end
const cors = require('cors');
const app = express(); // an express application
const port = 3001; //port number
const Redis = require('redis'); //import the radis class from library
const bodyParser = require('body-parser'); //Processes user data

const options ={
  origin:'http://localhost:3000'
}

app.use(cors(options));

const redisClient = Redis.createClient({
    host: 'localhost',
    port: 6379
 });
 
 redisClient.on('connect', () => {
    // Call this function during the application startup
    initializeCustomerPaymentsKey(redisClient);
    console.log('Connected to Redis');
 });

app.listen(port,()=>{
    redisClient.connect(); //this connect to the database
    console.log(`API is Listening on Port : ${port}`)
}); //listen for request from the front end 

app.use(bodyParser.json());

app.get('/boxes', async (req, res) => {// Handle GET requests to '/boxes'
   try{
   
   const boxesArray = await redisClient.json.get(`boxes`, { path: `$` });
   // Check if the data is wrapped in an extra array
   const boxes = Array.isArray(boxesArray) ? boxesArray[0] : boxesArray;
   res.send(boxes);

   }catch(error){
    console.error(error);
    res.status(500).send('1. Internal Server Error')
   }
  
  });

app.post('/boxes', async (req, res) => {
  
    try {
        const newBox = req.body;
        newBox.id = await redisClient.json.arrLen(`boxes`, `$`) + 1;
        await redisClient.json.arrAppend('boxes', `$`, newBox);
        res.status(200).send('Box added successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
    
  });

console.log("Starting... .  ."); 



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
    
    const existingPayments = await redisClient.json.get('customerPayments');
    const clientID = `${existingPayments.length+1}`;
    console.log(existingPayments);

    if (existingPayments && existingPayments.length > 0) {
        // Customer already exists, update their information in the list
        userPaymentDetails.customerID =  `clientID:${userPaymentDetails.zipCode}-000-00${clientID + 1}`;
        await redisClient.json.arrAppend('customerPayments', '$', userPaymentDetails);
        console.log(`Updated customer information for ${clientID}`);
    } else {
        // Customer does not exist, create a new entry in the list
        userPaymentDetails.customerID =  `clientID:${userPaymentDetails.zipCode}-000-00${clientID + 1}`;
        await redisClient.json.arrAppend('customerPayments', '$', userPaymentDetails);
        console.log(`Added new customer with ID ${clientID}`);
    }
};



app.get('/payments', async (req, res) => {// Handle GET requests to '/boxes'
    try{
    
    const boxesArray = await redisClient.json.get(`customerPayments`, { path: `$` });
    // Check if the data is wrapped in an extra array
    const boxes = Array.isArray(boxesArray) ? boxesArray[0] : boxesArray;
    res.send(boxes);
 
    }catch(error){
     console.error(error);
     res.status(500).send('1. Internal Server Error')
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