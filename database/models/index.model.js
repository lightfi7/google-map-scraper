const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    search: [],
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
const Index = mongoose.model("indices", schema);
module.exports = Index;
