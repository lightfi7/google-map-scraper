const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "countries",
      index: true,
    },
    division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "divisions",
      index: true,
    },
    sub_division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "sub_divisions",
      index: true,
    },
    city: {},
  },
  { timestamps: true }
);
const City = mongoose.model("cities", schema);
module.exports = City;
