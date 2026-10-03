// backend/wipe.js
import "dotenv/config";
import mongoose from "mongoose";
import Team from "./src/model/user.schema.js";

await mongoose.connect(process.env.MONGODB_URI);
const result = await Team.deleteMany({});
console.log(`🗑️  Deleted ${result.deletedCount} teams.`);
process.exit(0);