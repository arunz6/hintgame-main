import mongoose from "mongoose";

const huntSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "main" },
    status: { type: String, enum: ["setup", "countdown", "running", "ended"], default: "setup" },
    startsAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Hunt = mongoose.models.Hunt || mongoose.model("Hunt", huntSchema);
export default Hunt;
