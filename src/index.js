// require('dotenv').config({path: './env'})
import 'dotenv/config'; 
// import dotenv from "dotenv"
import connectDB from "./db/index.js";
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";

// dotenv.config({
//     path: './.env'
// }) 
// This is old method for connection 


connectDB()






/*
( async () => {
    try {
        mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    } catch (error) {
        console.error("ERROR:", error)
        throw err
    }

})()




"scripts": {
   "dev": "nodemon -r dotenv/config --experimental-json-modules src/index.js"
 },



 New Method  "dev": "node ...",
    */
