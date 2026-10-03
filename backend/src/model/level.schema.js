// backend/src/model/level.schema.js
import mongoose from "mongoose";

const levelSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    mcq: {
      question: { type: String, required: true },
      options: { type: [String], required: true },
      correctIndex: { type: Number, required: true },
    },

    // per-group clue & code
    groups: {
      A: {
        clue: { type: String, required: true },
        secretCode: { type: String, required: true, uppercase: true },
      },
      B: {
        clue: { type: String, required: true },
        secretCode: { type: String, required: true, uppercase: true },
      },
      C: {
        clue: { type: String, required: true },
        secretCode: { type: String, required: true, uppercase: true },
      },
    },
  },
  { timestamps: true }
);

const Level = mongoose.models.Level || mongoose.model("Level", levelSchema);
export default Level;