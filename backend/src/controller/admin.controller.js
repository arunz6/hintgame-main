// backend/src/controller/admin.controller.js
import Team from "../model/user.schema.js";
import Level from "../model/level.schema.js";

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 5;
const GROUPS = ["A", "B", "C", "D"];

function checkKey(req, res) {
  const key = req.headers["x-admin-key"] || req.body?.adminKey;
  if (key !== process.env.ADMIN_KEY) {
    res.status(401).json({ message: "Invalid admin key." });
    return false;
  }
  return true;
}

/* ---------- OVERVIEW ---------- */
export async function overview(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const teams = await Team.find().sort({ currentLevel: -1, startedAt: 1 });
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
    return res.json({ teams: data, maxMembers: MAX_MEMBERS });
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

    if (!teamName || !teamCode || !password)
      return res.status(400).json({ message: "teamName, teamCode, password are required." });
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
    await Team.findByIdAndDelete(teamId);
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
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });

    if (teamName) team.teamName = teamName.trim();
    if (teamCode) team.teamCode = teamCode.trim().toUpperCase();
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
    console.error(e);
    return res.status(500).json({ message: "Could not update team." });
  }
}

/* ---------- RESET PASSWORD ---------- */
export async function resetPassword(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    const team = await Team.findById(teamId).select("+password");
    if (!team) return res.status(404).json({ message: "Team not found." });

    team.password = newPassword;
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
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    const member = team.members.id(memberId);
    if (!member) return res.status(404).json({ message: "Member not found." });
    member.name = name.trim();
    await team.save();
    return res.json({ message: "Member updated." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not update member." });
  }
}

/* ---------- MEMBER: ADD ---------- */
export async function addMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, name } = req.body;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (team.members.length >= MAX_MEMBERS)
      return res.status(400).json({ message: `Team already has max ${MAX_MEMBERS} members.` });
    team.members.push({ name: name.trim() });
    await team.save();
    return res.json({ message: "Member added." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not add member." });
  }
}

/* ---------- MEMBER: DELETE ---------- */
export async function deleteMember(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId, memberId } = req.body;
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
    console.error(e);
    return res.status(500).json({ message: "Could not delete member." });
  }
}

/* ---------- DISQUALIFY ---------- */
export async function disqualify(req, res) {
  if (!checkKey(req, res)) return;
  try {
    const { teamId } = req.body;
    await Team.findByIdAndUpdate(teamId, {
      status: "eliminated",
      eliminatedAt: new Date(),
    });
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
    await Team.findByIdAndUpdate(teamId, { lockUntil: null, wrongAttempts: 0 });
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
  return res.json({ levels });
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
          !set?.clue ||
          !set?.secretCode ||
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
      level.groups[group].finalized = finalized;
      await level.save();
    }

    return res.json({
      message: finalized ? `Set ${group} finalized and locked.` : `Set ${group} reopened for editing.`,
      finalized,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Could not update set status." });
  }
}