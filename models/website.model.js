const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    url: { type: String, required: true, unique: true, index: true },
    result: {},
  },
  { timestamps: true }
);
const Website = mongoose.model("websites", schema);
module.exports = Website;
