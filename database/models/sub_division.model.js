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
    sub_division: {},
  },
  { timestamps: true }
);
const SubDivision = mongoose.model("sub_divisions", schema);
module.exports = SubDivision;
