const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    place_id: {
      type: String,
      unique: true,
      required: true,
      dropDups: true,
      index: true,
    },
    result: {},
  },
  { timestamps: true }
);
const GMap = mongoose.model("gmaps", schema);
module.exports = GMap;
