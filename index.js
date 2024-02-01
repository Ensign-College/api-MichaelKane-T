const express = require('express');//Express makes APIs connects front end to back end
const cors = require('cors');
const app = express(); // an express application
const port = 3001; //port number
const Redis = require('redis'); //import the radis class from library
const bodyParser = require('body-parser'); //Processes user data

app.use(cors());

// const redisClient =Redis.createClient({
//  url: `redis://localhost:6379`
// });
const redisClient = Redis.createClient({
    host: 'localhost',
    port: 6379
 });
 
 redisClient.on('connect', () => {
    console.log('Connected to Redis');
 });

app.listen(port,()=>{
    redisClient.connect(); //this connect to the database
    console.log(`API is Listening on Port : ${port}`)
}); //listen for request from the front end 

app.use(bodyParser.json());
//1- URL
//2 - req to from browser
//3 - res the response from the browser

app.get('/boxes', async (req, res) => {
    // Handle GET requests to '/boxes'
  
    // Use the Redis client to retrieve JSON data stored at the key 'boxes'
    let boxesArray = await redisClient.json.get(`boxes`, { path: `$` });
  
    // Check if the data is wrapped in an extra array
    let boxes = Array.isArray(boxesArray) ? boxesArray[0] : boxesArray;
  
    // Send the retrieved JSON data as the response to the browser
    res.send(boxes);
  });

app.post('/boxes', async (req, res) => {
  
  
      const newBox = req.body; // Assuming the request body contains the new data
      newBox.id= await  parseInt(redisClient.json.arrLen(`boxes`,`$`)+1);
  
      await redisClient.json.arrAppend('boxes',`$`, newBox)
      res.json();
    
  });

console.log("Hello"); 