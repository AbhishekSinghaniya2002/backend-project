// require('dotenv').config({path: './env'})
// import 'dotenv/config'; 
import dotenv from "dotenv"
import connectDB from "./db/index.js";
// import mongoose from "mongoose";
// import { DB_NAME } from "./constants.js";
import {app} from './app.js'

dotenv.config({
    path: './.env'
}) 


connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed!!!!!! ", err);

})





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
