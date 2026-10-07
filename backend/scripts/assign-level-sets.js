import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Hunt from "../src/model/hunt.schema.js";
import Team from "../src/model/user.schema.js";

const SETS = ["A", "B", "C", "D"];
const LEVELS = [1, 2, 3, 4];
const csvPath = fileURLToPath(new URL("./team-sets.csv", import.meta.url));

function parseAssignments(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const expectedHeader = "teamCode,level1,level2,level3,level4";
  if (headerLine !== expectedHeader) throw new Error(`CSV header must be: ${expectedHeader}`);

  const assignments = lines.map((line, index) => {
    const [teamCode, ...levelSets] = line.split(",").map((value) => value.trim());
    if (!teamCode || levelSets.length !== 4 || levelSets.some((set) => !SETS.includes(set))) {
      throw new Error(`Invalid team assignment on CSV line ${index + 2}.`);
    }
    return { teamCode: teamCode.toUpperCase(), levelSets };
  });
  const teamCodes = assignments.map(({ teamCode }) => teamCode);
  if (new Set(teamCodes).size !== teamCodes.length)
    throw new Error("CSV contains duplicate team codes.");
  return assignments;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  const assignments = parseAssignments(await readFile(csvPath, "utf8"));
  await mongoose.connect(process.env.MONGODB_URI);

  const hunt = await Hunt.findById("main").lean();
  if (hunt?.status === "running" || hunt?.status === "countdown")
    throw new Error("Cannot assign team level sets while a hunt is running or starting.");

  const operations = assignments.map(({ teamCode, levelSets }) => ({
    updateOne: {
      filter: { teamCode },
      update: { $set: { levelSets, group: levelSets[0] } },
      upsert: false,
    },
  }));
  const result = await Team.bulkWrite(operations, { ordered: true });

  const csvTeamCodes = new Set(assignments.map(({ teamCode }) => teamCode));
  const databaseTeams = await Team.find().select("teamCode levelSets").lean();
  const databaseTeamCodes = new Set(databaseTeams.map((team) => team.teamCode.toUpperCase()));
  const missingFromDatabase = [...csvTeamCodes].filter((teamCode) => !databaseTeamCodes.has(teamCode));
  const databaseOnly = databaseTeams
    .filter((team) => !csvTeamCodes.has(team.teamCode.toUpperCase()))
    .map((team) => team.teamCode);
  const teamsWithoutLevelSets = databaseTeams
    .filter((team) => !csvTeamCodes.has(team.teamCode.toUpperCase()) && team.levelSets?.length !== 4)
    .map((team) => team.teamCode);

  const counts = Object.fromEntries(
    LEVELS.map((level) => [level, Object.fromEntries(SETS.map((set) => [set, 0]))]),
  );
  for (const team of databaseTeams) {
    if (!Array.isArray(team.levelSets) || team.levelSets.length !== 4) continue;
    team.levelSets.forEach((set, index) => {
      if (SETS.includes(set)) counts[index + 1][set] += 1;
    });
  }

  console.log(`Teams updated (matched): ${result.matchedCount}`);
  console.log("CSV teamCodes not found in database:", missingFromDatabase.length ? missingFromDatabase.join(", ") : "none");
  console.log("Database teamCodes not in CSV:", databaseOnly.length ? databaseOnly.join(", ") : "none");
  console.log("Database teams not in CSV without four levelSets:", teamsWithoutLevelSets.length ? teamsWithoutLevelSets.join(", ") : "none");
  console.log("Teams per set for each level:");
  console.table(LEVELS.map((level) => ({ level, ...counts[level] })));
}

main()
  .catch((error) => {
    console.error("Could not assign team level sets:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
