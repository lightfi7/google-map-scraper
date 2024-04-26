const mongoose = require("mongoose");
const GMap = require("./models/gmap.model");
const Website = require("./models/website.model");
const Index = require("./models/index.model");
const KeyWord = require("./models/keyword.model");
mongoose.Promise = global.Promise;

const makeDBConnection = () =>
  new Promise((resolve, reject) => {
    mongoose
      .connect(process.env.MONGODB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: process.env.DB_NAME,
        user: process.env.DB_USER,
        pass: process.env.DB_PASSWORD,
      })
    // mongoose
    //   .connect("mongodb://127.0.0.1:27017/homestead")
      .then(() => {
        console.log("Connected to the database!");
        resolve();
      })
      .catch((err) => {
        console.log("Cannot connect to the database!", err);
        reject(err);
      });
  });

module.exports = { makeDBConnection, GMap, Index, Website, KeyWord };
