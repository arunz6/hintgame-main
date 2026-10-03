// backend/src/model/level.schema.js
import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    mcq: {
      question: { type: String, trim: true },
      options: { type: [String], default: undefined },
      correctIndex: { type: Number },
    },
    clue: { type: String, trim: true },
    secretCode: { type: String, uppercase: true, trim: true },
    finalized: { type: Boolean, default: false },
  },
  { _id: false }
);

const levelSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    mcq: {
      question: { type: String, required: true },
      options: { type: [String], required: true },
      correctIndex: { type: Number, required: true },
    },

    groups: {
      A: { type: groupSchema, default: () => ({}) },
      B: { type: groupSchema, default: () => ({}) },
      C: { type: groupSchema, default: () => ({}) },
      D: { type: groupSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

const Level = mongoose.models.Level || mongoose.model("Level", levelSchema);
export default Level;