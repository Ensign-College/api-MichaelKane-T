const express = require('express');//Express makes APIs connects front end to back end
const app = express(); // an express application
const port = 3000; //port number
const Redis = require('redis'); //import the radis class from library
const bodyParser = require('body-parser'); //Processes user data

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

app.get('/boxes', async(req, res)=>{

    let boxes = await redisClient.json.get(`boxes`, {path: `$`});//get the boxes //{path: `$` }
    res.send(JSON.stringify(boxes)); //send box to the browser //convert boxes too a string
})//return boxes to user

app.post('/boxes', async (req, res) => {
  
  
      const newBox = req.body; // Assuming the request body contains the new data
      newBox.id= await  parseInt(redisClient.json.arrLen(`boxes`,`$`)+1);
  
      await redisClient.json.arrAppend('boxes',`$`, newBox)
      res.json();
    
  });

console.log("Hello"); 