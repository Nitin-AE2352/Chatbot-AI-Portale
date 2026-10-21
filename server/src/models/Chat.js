
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    question: {
      type: String,
      required: true,
      trim: true
    },

    answer: {
      type: String,
      required: true
    },

    sources: [
      {
        document: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document"
        },
        fileName: {
          type: String
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Chat", chatSchema);
