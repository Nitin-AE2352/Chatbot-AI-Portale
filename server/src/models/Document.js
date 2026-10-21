
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true
    },

    originalName: {
      type: String,
      required: true,
      trim: true
    },

    fileType: {
      type: String,
      required: true
    },

    fileSize: {
      type: Number,
      default: 0
    },

    filePath: {
      type: String,
      required: true
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Document", documentSchema);
