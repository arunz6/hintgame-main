import { randomInt } from "node:crypto";
import Team from "../model/user.schema.js";

export const GROUPS = ["A", "B", "C", "D"];
export const LEVELS = [1, 2, 3, 4];
let teamCreationQueue = Promise.resolve();

export function getTeamGroupForLevel(team, level) {
  const levelGroup = team.levelGroups?.get?.(`level${level}`)
    ?? team.levelGroups?.[`level${level}`];
  return GROUPS.includes(levelGroup) ? levelGroup : team.group;
}

export function serializeTeamLevelGroups(team) {
  return Object.fromEntries(
    LEVELS.map((level) => [`level${level}`, getTeamGroupForLevel(team, level)]),
  );
}

async function assignBalancedLevelGroups() {
  const assignments = await Promise.all(LEVELS.map(async (level) => {
    const counts = await Team.aggregate([
      {
        $group: {
          _id: { $ifNull: [`$levelGroups.level${level}`, "$group"] },
          count: { $sum: 1 },
        },
      },
    ]);
    const countByGroup = Object.fromEntries(GROUPS.map((group) => [group, 0]));
    for (const entry of counts) {
      if (GROUPS.includes(entry._id)) countByGroup[entry._id] = entry.count;
    }

    const minimumCount = Math.min(...Object.values(countByGroup));
    const leastAssignedGroups = GROUPS.filter(
      (group) => countByGroup[group] === minimumCount,
    );
    return leastAssignedGroups[randomInt(leastAssignedGroups.length)];
  }));

  return Object.fromEntries(LEVELS.map((level, index) => [`level${level}`, assignments[index]]));
}

export function createTeamWithBalancedLevelGroups(teamData) {
  const creation = teamCreationQueue.then(async () => {
    const levelGroups = await assignBalancedLevelGroups();
    return Team.create({
      ...teamData,
      group: levelGroups.level1,
      levelGroups,
    });
  });
  teamCreationQueue = creation.then(() => undefined, () => undefined);
  return creation;
}
