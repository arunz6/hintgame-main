import mongoose from "mongoose";
import Hunt from "../model/hunt.schema.js";
import Team from "../model/user.schema.js";

export async function getHuntState() {
  const currentHunt = await Hunt.findById("main").lean();
  if (
    currentHunt?.status !== "countdown" ||
    !currentHunt.startsAt ||
    currentHunt.startsAt > new Date()
  ) {
    return currentHunt || { status: "setup", startsAt: null, startedAt: null };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const hunt = await Hunt.findOneAndUpdate(
        {
          _id: "main",
          status: "countdown",
          startsAt: { $lte: new Date() },
        },
        { $set: { status: "running", startedAt: currentHunt.startsAt } },
        { new: true, session },
      );
      if (!hunt) return;

      await Team.updateMany(
        { status: "not_started" },
        { $set: { status: "playing", startedAt: hunt.startsAt } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return Hunt.findById("main").lean();
}
