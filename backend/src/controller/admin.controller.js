// backend/src/controller/admin.controller.js
import Team from "../model/user.schema.js";
import Level from "../model/level.schema.js";
import Hunt from "../model/hunt.schema.js";
import { getHuntState } from "../utils/hunt-state.js";
import mongoose from "mongoose";
import { timingSafeEqual } from "node:crypto";

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 5;
const GROUPS = ["A", "B", "C", "D"];

function getHuntReadinessProblems(teams, levels) {
  const problems = [];
  if (teams.length < 2) problems.push("At least 2 teams are required.");

  const groups = [...new Set(teams.map((team) => team.group))];
  for (const group of groups) {
    for (let number = 1; number <= 4; number += 1) {
      const level = levels.find((item) => item.number === number);
      const set = level?.groups?.[group];
      const mcq = set?.mcq;
      if (
        !set?.finalized ||
        !set.clue?.trim() ||
        !set.secretCode?.trim() ||
        !mcq?.question?.trim() ||
        !Array.isArray(mcq.options) ||
        mcq.options.length < 2 ||
        mcq.options.length > 4 ||
        mcq.options.some((option) => !option?.trim()) ||
        !Number.isInteger(mcq.correctIndex) ||
        mcq.correctIndex < 0 ||
        mcq.correctIndex >= mcq.options.length
      ) {
        problems.push(`Set ${group}, Level ${number} is incomplete or not finalized.`);
      }
    }
  }
  return problems;
}

function checkKey(req, res) {
  const configuredKey = process.env.ADMIN_KEY;
  const suppliedKey = req.headers["x-admin-key"];
  const validKey = typeof configuredKey === "string"
    && configuredKey.length > 0
    && typeof suppliedKey === "string"
    && Buffer.byteLength(configuredKey) === Buffer.byteLength(suppliedKey)
    && timingSafeEqual(Buffer.from(configuredKey), Buffer.from(suppliedKey));
  if (!validKey) {
    res.status(401).json({ message: "Invalid admin key." });
    return false;
  }
  return true;
}

/* ---------- OVERVIEW ---------- */
export async function overview(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const hunt = await getHuntState();
    const [teams, levels] = await Promise.all([
      Team.find().sort({ currentLevel: -1, startedAt: 1 }),
      Level.find({ number: { $gte: 1, $lte: 4 } }).lean(),
    ]);
    const now = new Date();
    const data = teams.map((t) => ({
      id: t._id,
      teamName: t.teamName,
      teamCode: t.teamCode,
      group: t.group,
      members: t.members.map((m) => ({ id: m._id, name: m.name })),
      currentLevel: t.currentLevel,
      status: t.status,
      lockUntil: t.lockUntil,
      lockedNow: t.lockUntil && t.lockUntil > now,
      finalRank: t.finalRank,
      wrongAttempts: t.wrongAttempts,
      createdAt: t.createdAt,
    }));
    const activeTeams = teams.filter((team) => team.status !== "disqualified");
    return res.json({
      teams: data,
      maxMembers: MAX_MEMBERS,
      hunt: hunt || { status: "setup", startedAt: null },
      readinessProblems: getHuntReadinessProblems(activeTeams, levels),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load overview." });
  }
}

/* ---------- ADD TEAM ---------- */
export async function addTeam(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamName, teamCode, password, members, group } = req.body;

    if (
      typeof teamName !== "string" || !teamName.trim() ||
      typeof teamCode !== "string" || !teamCode.trim() ||
      typeof password !== "string" || password.length < 6
    )
      return res.status(400).json({ message: "Team name and code are required; password must be at least 6 characters." });
    if (!GROUPS.includes(group))
      return res.status(400).json({ message: "Group must be A, B, C, or D." });

    const normalizedMembers = Array.isArray(members)
      ? members.map((m) => String(m).trim()).filter(Boolean)
      : [];

    if (normalizedMembers.length < MIN_MEMBERS || normalizedMembers.length > MAX_MEMBERS)
      return res.status(400).json({ message: `A team must have ${MIN_MEMBERS} to ${MAX_MEMBERS} members.` });

    const team = await Team.create({
      teamName: teamName.trim(),
      teamCode: teamCode.trim().toUpperCase(),
      password,
      group,
      members: normalizedMembers.map((name) => ({ name })),
    });

    return res.status(201).json({
      message: "Team added.",
      team: { id: team._id, teamName: team.teamName, teamCode: team.teamCode, group: team.group },
    });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ message: "Team name/code already exists." });
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not add team." });
  }
}

/* ---------- DELETE TEAM ---------- */
export async function deleteTeam(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ message: "A valid team ID is required." });
    const team = await Team.findByIdAndDelete(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    return res.json({ message: "Team deleted." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not delete team." });
  }
}

/* ---------- UPDATE TEAM ---------- */
export async function updateTeam(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, teamName, teamCode, group } = req.body;
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ message: "A valid team ID is required." });
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });

    if (teamName !== undefined) {
      if (typeof teamName !== "string" || !teamName.trim())
        return res.status(400).json({ message: "Team name cannot be empty." });
      team.teamName = teamName.trim();
    }
    if (teamCode !== undefined) {
      if (typeof teamCode !== "string" || !teamCode.trim())
        return res.status(400).json({ message: "Team code cannot be empty." });
      team.teamCode = teamCode.trim().toUpperCase();
    }
    if (group) {
      if (!GROUPS.includes(group))
        return res.status(400).json({ message: "Group must be A, B, C, or D." });
      team.group = group;
    }

    await team.save();
    return res.json({ message: "Team updated." });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ message: "Team name/code already exists." });
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not update team." });
  }
}

/* ---------- RESET PASSWORD ---------- */
export async function resetPassword(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, newPassword } = req.body;
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ message: "A valid team ID is required." });
    if (typeof newPassword !== "string" || newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    const team = await Team.findById(teamId).select("+password");
    if (!team) return res.status(404).json({ message: "Team not found." });

    team.password = newPassword;
    team.activeSessionId = null;
    team.activeSessionExpiresAt = null;
    await team.save();
    return res.json({ message: "Password reset successfully." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not reset password." });
  }
}

/* ---------- MEMBER: UPDATE ---------- */
export async function updateMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, memberId, name } = req.body;
    if (!mongoose.isValidObjectId(teamId) || !mongoose.isValidObjectId(memberId))
      return res.status(400).json({ message: "Valid team and member IDs are required." });
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "Member name cannot be empty." });
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    const member = team.members.id(memberId);
    if (!member) return res.status(404).json({ message: "Member not found." });
    member.name = name.trim();
    await team.save();
    return res.json({ message: "Member updated." });
  } catch (e) {
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not update member." });
  }
}

/* ---------- MEMBER: ADD ---------- */
export async function addMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, name } = req.body;
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ message: "A valid team ID is required." });
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "Member name cannot be empty." });
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.members.length >= MAX_MEMBERS)
      return res.status(400).json({ message: `Team already has max ${MAX_MEMBERS} members.` });
    team.members.push({ name: name.trim() });
    await team.save();
    return res.json({ message: "Member added." });
  } catch (e) {
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not add member." });
  }
}

/* ---------- MEMBER: DELETE ---------- */
export async function deleteMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, memberId } = req.body;
    if (!mongoose.isValidObjectId(teamId) || !mongoose.isValidObjectId(memberId))
      return res.status(400).json({ message: "Valid team and member IDs are required." });
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.members.length <= MIN_MEMBERS)
      return res.status(400).json({ message: `Team must have at least ${MIN_MEMBERS} members.` });
    const member = team.members.id(memberId);
    if (!member) return res.status(404).json({ message: "Member not found." });
    member.deleteOne();
    await team.save();
    return res.json({ message: "Member deleted." });
  } catch (e) {
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not delete member." });
  }
}

/* ---------- DISQUALIFY ---------- */
export async function disqualify(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ message: "A valid team ID is required." });
    const team = await Team.findByIdAndUpdate(teamId, {
      status: "eliminated",
      eliminatedAt: new Date(),
    });
    if (!team) return res.status(404).json({ message: "Team not found." });
    return res.json({ message: "Team disqualified." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not disqualify." });
  }
}

/* ---------- RESET LOCK ---------- */
export async function resetLock(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    if (!mongoose.isValidObjectId(teamId))
      return res.status(400).json({ message: "A valid team ID is required." });
    const team = await Team.findByIdAndUpdate(teamId, { lockUntil: null, wrongAttempts: 0 });
    if (!team) return res.status(404).json({ message: "Team not found." });
    return res.json({ message: "Lock cleared." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not reset lock." });
  }
}

/* ---------- LEVEL QUESTION SETS ---------- */
export async function getLevels(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const levels = await Level.find({ number: { $gte: 1, $lte: 4 } })
      .sort({ number: 1 })
      .lean();
    const setStatuses = await Promise.all(GROUPS.map(async (group) => {
      const missingLevels = [];
      const codes = [];
      for (let number = 1; number <= 4; number += 1) {
        const level = levels.find((item) => item.number === number);
        const set = level?.groups?.[group];
        const mcq = set?.mcq;
        if (
          !set?.finalized ||
          typeof set?.clue !== "string" ||
          !set.clue.trim() ||
          typeof set?.secretCode !== "string" ||
          !set.secretCode.trim() ||
          typeof mcq?.question !== "string" ||
          !mcq.question.trim() ||
          !Array.isArray(mcq.options) ||
          mcq.options.length < 2 ||
          mcq.options.length > 4 ||
          mcq.options.some((option) => typeof option !== "string" || !option.trim()) ||
          !Number.isInteger(mcq.correctIndex) ||
          mcq.correctIndex < 0 ||
          mcq.correctIndex >= mcq.options.length
        ) {
          missingLevels.push(number);
        } else {
          codes.push(set.secretCode.trim().toUpperCase());
        }
      }
      if (new Set(codes).size !== codes.length) {
        for (let number = 1; number <= 4; number += 1) {
          if (!missingLevels.includes(number)) missingLevels.push(number);
        }
      }
      return {
        group,
        ready: missingLevels.length === 0,
        missingLevels,
        assignedTeams: await Team.countDocuments({ group }),
      };
    }));
    return res.json({ levels, setStatuses });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not load level question sets." });
  }
}

export async function saveQuestionSet(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { group, levels } = req.body ?? {};
    if (!GROUPS.includes(group))
      return res.status(400).json({ message: "Set must be A, B, C, or D." });
    if (!Array.isArray(levels) || levels.length !== 4)
      return res.status(400).json({ message: "Exactly four levels are required." });

    const orderedLevels = [...levels].sort((a, b) => a?.number - b?.number);
    const normalizedLevels = [];
    for (let index = 0; index < orderedLevels.length; index += 1) {
      const level = orderedLevels[index];
      if (
        !level ||
        level.number !== index + 1 ||
        typeof level.title !== "string" ||
        !level.title.trim() ||
        typeof level.question !== "string" ||
        !level.question.trim() ||
        !Array.isArray(level.options) ||
        level.options.length < 2 ||
        level.options.length > 4 ||
        level.options.some((option) => typeof option !== "string" || !option.trim()) ||
        !Number.isInteger(level.correctIndex) ||
        level.correctIndex < 0 ||
        level.correctIndex >= level.options.length ||
        typeof level.clue !== "string" ||
        !level.clue.trim() ||
        typeof level.secretCode !== "string" ||
        !level.secretCode.trim()
      ) {
        return res.status(400).json({
          message: `Level ${index + 1} needs a title, question, 2-4 options, a correct answer, clue, and code.`,
        });
      }
      normalizedLevels.push({
        number: level.number,
        title: level.title.trim(),
        mcq: {
          question: level.question.trim(),
          options: level.options.map((option) => option.trim()),
          correctIndex: level.correctIndex,
        },
        clue: level.clue.trim(),
        secretCode: level.secretCode.trim().toUpperCase(),
      });
    }

    const codes = normalizedLevels.map((level) => level.secretCode);
    if (new Set(codes).size !== codes.length)
      return res.status(400).json({ message: "Each level in a set must have a different unlock code." });

    const existingLevels = await Level.find({ number: { $gte: 1, $lte: 4 } });
    if (existingLevels.some((level) => level.groups?.[group]?.finalized))
      return res.status(409).json({
        message: `Set ${group} is finalized. Reopen it before changing its questions.`,
      });

    for (const data of normalizedLevels) {
      const level = existingLevels.find((item) => item.number === data.number)
        || new Level({ number: data.number, title: data.title, mcq: data.mcq });
      level.title = data.title;
      level.groups[group] = {
        mcq: data.mcq,
        clue: data.clue,
        secretCode: data.secretCode,
        finalized: false,
      };
      await level.save();
    }

    const savedLevels = await Level.find({ number: { $gte: 1, $lte: 4 } })
      .sort({ number: 1 })
      .lean();
    return res.json({ message: `All four levels for Set ${group} saved as a draft.`, levels: savedLevels });
  } catch (e) {
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not save level question set." });
  }
}

export async function setQuestionSetFinalized(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { group, finalized } = req.body ?? {};
    if (!GROUPS.includes(group) || typeof finalized !== "boolean")
      return res.status(400).json({ message: "A valid set and finalized status are required." });

    const levels = await Level.find({ number: { $gte: 1, $lte: 4 } }).sort({ number: 1 });
    if (levels.length !== 4 || levels.some((level, index) => level.number !== index + 1))
      return res.status(400).json({ message: "Save all four levels before finalizing a set." });

    if (finalized) {
      const codes = [];
      for (const level of levels) {
        const set = level.groups?.[group];
        const mcq = set?.mcq?.question ? set.mcq : null;
        if (
          typeof set?.clue !== "string" ||
          !set.clue.trim() ||
          typeof set?.secretCode !== "string" ||
          !set.secretCode.trim() ||
          !mcq?.question ||
          !Array.isArray(mcq.options) ||
          mcq.options.length < 2 ||
          !Number.isInteger(mcq.correctIndex) ||
          mcq.correctIndex < 0 ||
          mcq.correctIndex >= mcq.options.length
        ) {
          return res.status(400).json({
            message: `Set ${group} is incomplete at Level ${level.number}. Save all four levels first.`,
          });
        }
        codes.push(set.secretCode.trim().toUpperCase());
      }
      if (new Set(codes).size !== codes.length)
        return res.status(400).json({ message: "Each level in a set must have a different unlock code." });
    }

    for (const level of levels) {
      level.set(`groups.${group}.finalized`, finalized);
      await level.save();
    }

    return res.json({
      message: finalized ? `Set ${group} finalized and locked.` : `Set ${group} reopened for editing.`,
      finalized,
    });
  } catch (e) {
    if (e.name === "ValidationError")
      return res.status(400).json({ message: e.message });
    console.error(e);
    return res.status(500).json({ message: "Could not update set status." });
  }
}

export async function startHunt(req, res) {
  if (!checkKey(req, res)) return;
  let session;
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB connection is not ready.");
    const huntCollectionExists = await db.listCollections(
      { name: Hunt.collection.name },
      { nameOnly: true },
    ).hasNext();
    if (!huntCollectionExists) await Hunt.createCollection();

    session = await mongoose.startSession();
    let startsAt;
    let isNewGame = false;
    await session.withTransaction(async () => {
      const currentHunt = await Hunt.findById("main").session(session);
      if (currentHunt?.status === "running" || currentHunt?.status === "countdown") {
        const message = currentHunt.status === "countdown"
          ? "The hunt countdown is already in progress."
          : "The hunt has already started.";
        const error = new Error(message);
        error.statusCode = 409;
        throw error;
      }

      const teams = await Team.find().session(session);
      const levels = await Level.find({ number: { $gte: 1, $lte: 4 } }).session(session);
      const problems = getHuntReadinessProblems(teams, levels);
      if (problems.length) {
        const error = new Error(problems.join(" "));
        error.statusCode = 400;
        throw error;
      }

      startsAt = new Date();
      isNewGame = currentHunt?.status === "ended";
      await Team.updateMany(
        isNewGame ? {} : { status: "not_started" },
        {
          $set: isNewGame
            ? {
                status: "playing",
                currentLevel: 1,
                startedAt: startsAt,
                finishedAt: null,
                penaltySeconds: 0,
                hintsUsed: 0,
                levelSolvedAt: [],
                lockUntil: null,
                lockCount: 0,
                wrongAttempts: 0,
                lastLockedLevel: null,
                eliminatedAt: null,
                finalRank: null,
                completionRank: null,
              }
            : { status: "playing", startedAt: startsAt },
        },
        { session },
      );

      const hunt = currentHunt || new Hunt({ _id: "main" });
      hunt.status = "running";
      hunt.startsAt = null;
      hunt.startedAt = startsAt;
      hunt.endedAt = null;
      await hunt.save({ session });
    });

    return res.json({
      message: isNewGame
        ? "The new game has started. Team progress has been reset."
        : "The game has started.",
      hunt: { status: "running", startedAt: startsAt },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 112 || error.code === 251)
      return res.status(409).json({ message: "The hunt is starting. Refresh the admin panel and check its status." });
    console.error("Could not start hunt:", error);
    return res.status(500).json({ message: "Could not start the hunt. Check the backend logs for details." });
  } finally {
    if (session) await session.endSession();
  }
}

export async function endHunt(req, res) {
  if (!checkKey(req, res)) return;
  let session;
  try {
    session = await mongoose.startSession();
    let endedAt;
    await session.withTransaction(async () => {
      const hunt = await Hunt.findById("main").session(session);
      if (!hunt || (hunt.status !== "countdown" && hunt.status !== "running")) {
        const error = new Error(
          hunt?.status === "ended"
            ? "The game has already ended."
            : "The game has not started.",
        );
        error.statusCode = 409;
        throw error;
      }

      endedAt = new Date();
      hunt.status = "ended";
      hunt.endedAt = endedAt;
      await hunt.save({ session });
    });

    return res.json({
      message: "The game has ended. Team progress and results have been kept.",
      hunt: { status: "ended", endedAt },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 112 || error.code === 251)
      return res.status(409).json({ message: "The game is ending. Refresh the admin panel to check its status." });
    console.error("Could not end game:", error);
    return res.status(500).json({ message: "Could not end the game. Check the backend logs for details." });
  } finally {
    if (session) await session.endSession();
  }
}