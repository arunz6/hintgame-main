import mongoose from "mongoose";

const huntSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "main" },
    status: { type: String, enum: ["setup", "running"], default: "setup" },
    startedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Hunt = mongoose.models.Hunt || mongoose.model("Hunt", huntSchema);
export default Hunt;
