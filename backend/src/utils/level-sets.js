import { randomInt } from "node:crypto";
import Team from "../model/user.schema.js";

export const GROUPS = ["A", "B", "C", "D"];
export const LEVELS = [1, 2, 3, 4];
let teamCreationQueue = Promise.resolve();

export function isValidLevelSets(levelSets) {
  return Array.isArray(levelSets) &&
    levelSets.length === LEVELS.length &&
    levelSets.every((set) => GROUPS.includes(set));
}

export function getSetKey(team, levelNumber) {
  const levelSet = team?.levelSets?.[levelNumber - 1];
  if (GROUPS.includes(levelSet)) return levelSet;
  return GROUPS.includes(team?.group) ? team.group : null;
}

export function serializeTeamLevelSets(team) {
  return Object.fromEntries(
    LEVELS.map((level) => [`level${level}`, getSetKey(team, level)]),
  );
}

export async function suggestLevelSets() {
  const assignments = await Promise.all(LEVELS.map(async (level) => {
    const counts = await Team.aggregate([
      {
        $group: {
          _id: {
            $ifNull: [
              { $arrayElemAt: ["$levelSets", level - 1] },
              "$group",
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const countBySet = Object.fromEntries(GROUPS.map((set) => [set, 0]));
    for (const entry of counts) {
      if (GROUPS.includes(entry._id)) countBySet[entry._id] = entry.count;
    }

    const minimumCount = Math.min(...Object.values(countBySet));
    const leastAssignedSets = GROUPS.filter((set) => countBySet[set] === minimumCount);
    return leastAssignedSets[randomInt(leastAssignedSets.length)];
  }));
  return assignments;
}

export function createTeamWithSuggestedLevelSets(teamData) {
  const creation = teamCreationQueue.then(async () => {
    const levelSets = Array.isArray(teamData.levelSets)
      ? teamData.levelSets
      : await suggestLevelSets();
    return Team.create({
      ...teamData,
      levelSets,
      group: levelSets[0],
    });
  });
  teamCreationQueue = creation.then(() => undefined, () => undefined);
  return creation;
}
