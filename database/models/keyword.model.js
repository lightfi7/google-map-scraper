const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    activity: String,
    country: String,
    division1: String,
    division2: String,
    city: String,
    place_id: {
      type: String,
      unique: true,
      required: true,
      dropDups: true,
      index: true,
    },
  },
  { timestamps: true }
);
const KeyWord = mongoose.model("keywords", schema);
module.exports = KeyWord;
