const mongoose = require("mongoose");
var schema = mongoose.Schema(
  {
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "countries",
      index: true,
    },
    division: {},
  },
  { timestamps: true }
);
const Division = mongoose.model("divisions", schema);
module.exports = Division;
