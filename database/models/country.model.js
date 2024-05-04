const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    country: {},
  },
  { timestamps: true }
);
const Country = mongoose.model("countries", schema);
module.exports = Country;
