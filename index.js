const express = require('express');//Express makes APIs connects front end to back end
const app = express(); // an express application

app.listen(3000); //listen for request from the front end 

const boxes = [
    {boxId:1},
    {boxId:2},
    {boxId:3},
    {boxId:4}
];

//1- URL
//2 - req to from browser
//
app.get('/boxes', (req, res)=>{
    //send box to the browser
    res.send(JSON.stringify(boxes)); //convert boxes too a string
})//return boxes to user

console.log("Hello");