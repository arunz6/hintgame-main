// backend/src/model/user.schema.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
});

const teamSchema = new mongoose.Schema(
  {
    teamName: { type: String, required: true, unique: true, trim: true },
    teamCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    group: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: true,
    },
    levelGroups: {
      type: Map,
      of: { type: String, enum: ["A", "B", "C", "D"] },
      default: () => new Map(),
    },

    password: { type: String, required: true, select: false },

    members: {
      type: [memberSchema],
      validate: {
        validator: (v) => v.length >= 2 && v.length <= 5,
        message: "Team must have 2 to 5 members.",
      },
    },

    activeSessionId: { type: String, default: null },
    activeSessionExpiresAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["not_started", "playing", "eliminated", "finished"],
      default: "not_started",
    },
    currentLevel: { type: Number, default: 1, min: 1, max: 4 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    penaltySeconds: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    levelSolvedAt: [{ _id: false, level: Number, at: Date }],

    lockUntil: { type: Date, default: null },
    lockCount: { type: Number, default: 0 },
    wrongAttempts: { type: Number, default: 0 },
    lastLockedLevel: { type: Number, default: null },
    eliminatedAt: { type: Date, default: null },
    finalRank: {
      type: String,
      enum: ["gold", "silver", "bronze", null],
      default: null,
    },
    completionRank: { type: Number, default: null },
  },
  { timestamps: true }
);

teamSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

teamSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

teamSchema.virtual("totalSeconds").get(function () {
  if (!this.startedAt || !this.finishedAt) return null;
  return Math.floor((this.finishedAt - this.startedAt) / 1000) + this.penaltySeconds;
});

teamSchema.set("toJSON", { virtuals: true });
teamSchema.index({ status: 1, finishedAt: 1 });

const Team = mongoose.models.Team || mongoose.model("Team", teamSchema);
export default Team;